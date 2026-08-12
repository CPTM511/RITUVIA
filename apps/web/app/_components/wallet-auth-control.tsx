"use client";

import { Button, InlineAlert, Skeleton } from "@rituvia/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import styles from "./identity-privacy.module.css";

export type WalletAuthMessages = Readonly<{
  action: string;
  description: string;
  empty: string;
  error: string;
  linked: string;
  linkedTitle: string;
  loading: string;
  noProvider: string;
  rejected: string;
  remove: string;
  removeConfirm: string;
  removed: string;
  signing: string;
  title: string;
  wrongChain: string;
}>;

type Eip1193Provider = Readonly<{
  request(input: Readonly<{ method: string; params?: readonly unknown[] }>): Promise<unknown>;
}>;

type WalletSummary = Readonly<{
  address: string;
  chainId: number;
  id: string;
  linkedAt: string;
}>;

type WalletAuthControlProps = Readonly<{
  csrfToken?: string | null | undefined;
  messages: WalletAuthMessages;
  mode: "link_wallet" | "sign_in";
}>;

const challengeEndpoint = "/api/v1/auth/wallet/challenge";
const verifyEndpoint = "/api/v1/auth/wallet/verify";
const walletsEndpoint = "/api/v1/me/wallets";
const baseSepoliaChainId = 84_532;
const addressPattern = /^0x[0-9a-fA-F]{40}$/u;
const signaturePattern = /^0x[0-9a-fA-F]{130}$/u;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseWallets = (value: unknown): readonly WalletSummary[] | null => {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.wallets)) return null;
  const wallets: WalletSummary[] = [];
  for (const candidate of value.wallets) {
    if (
      !isRecord(candidate) ||
      typeof candidate.id !== "string" ||
      !uuidPattern.test(candidate.id) ||
      typeof candidate.address !== "string" ||
      !/^0x[0-9a-f]{40}$/u.test(candidate.address) ||
      candidate.chainId !== baseSepoliaChainId ||
      typeof candidate.linkedAt !== "string" ||
      !Number.isFinite(Date.parse(candidate.linkedAt))
    ) {
      return null;
    }
    wallets.push(Object.freeze(candidate as WalletSummary));
  }
  return Object.freeze(wallets);
};

const walletLabel = (address: string): string => `${address.slice(0, 8)}…${address.slice(-6)}`;

const discoverProvider = (onProvider: (provider: Eip1193Provider) => void): (() => void) => {
  let selected = false;
  const accept = (candidate: unknown) => {
    if (!selected && isRecord(candidate) && typeof candidate.request === "function") {
      selected = true;
      onProvider(candidate as Eip1193Provider);
    }
  };
  const ethereum = (window as Window & { ethereum?: unknown }).ethereum;
  accept(ethereum);
  const announce = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (isRecord(detail)) accept(detail.provider);
  };
  window.addEventListener("eip6963:announceProvider", announce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  return () => window.removeEventListener("eip6963:announceProvider", announce);
};

export function WalletAuthControl({ csrfToken, messages, mode }: WalletAuthControlProps) {
  const provider = useRef<Eip1193Provider | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<
    "error" | "idle" | "linked" | "loading" | "no-provider" | "rejected" | "wrong-chain"
  >("idle");
  const [wallets, setWallets] = useState<readonly WalletSummary[]>([]);
  const [walletsLoading, setWalletsLoading] = useState(mode === "link_wallet");
  const [walletsError, setWalletsError] = useState(false);

  const loadWallets = useCallback(async () => {
    if (mode !== "link_wallet") return;
    setWalletsLoading(true);
    setWalletsError(false);
    try {
      const response = await fetch(walletsEndpoint, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new TypeError();
      const parsed = parseWallets((await response.json()) as unknown);
      if (parsed === null) throw new TypeError();
      setWallets(parsed);
    } catch {
      setWalletsError(true);
    } finally {
      setWalletsLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    const stop = discoverProvider((candidate) => {
      provider.current = candidate;
      setAvailable(true);
    });
    const timeout = window.setTimeout(() => {
      setAvailable((current) => current ?? false);
    }, 300);
    const loadTimer = window.setTimeout(() => void loadWallets(), 0);
    return () => {
      window.clearTimeout(loadTimer);
      window.clearTimeout(timeout);
      stop();
    };
  }, [loadWallets]);

  const execute = async (): Promise<void> => {
    if (phase === "loading") return;
    if (provider.current === null) {
      setPhase("no-provider");
      return;
    }
    if (mode === "link_wallet" && (csrfToken === null || csrfToken === undefined)) {
      setPhase("error");
      return;
    }
    setPhase("loading");
    try {
      const accounts = await provider.current.request({ method: "eth_requestAccounts" });
      const address = Array.isArray(accounts) ? accounts[0] : null;
      const chainHex = await provider.current.request({ method: "eth_chainId" });
      const chainId = typeof chainHex === "string" ? Number.parseInt(chainHex, 16) : Number.NaN;
      if (typeof address !== "string" || !addressPattern.test(address)) throw new TypeError();
      if (chainId !== baseSepoliaChainId) {
        setPhase("wrong-chain");
        return;
      }
      const protectedHeaders =
        mode === "link_wallet" ? { "x-csrf-token": csrfToken as string } : {};
      const challengeResponse = await fetch(challengeEndpoint, {
        body: JSON.stringify({ address, chainId, purpose: mode }),
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
          ...protectedHeaders,
        },
        method: "POST",
      });
      if (!challengeResponse.ok) throw new TypeError();
      const challenge = (await challengeResponse.json()) as unknown;
      if (
        !isRecord(challenge) ||
        typeof challenge.message !== "string" ||
        challenge.message.length > 2_048 ||
        typeof challenge.requestId !== "string" ||
        !uuidPattern.test(challenge.requestId)
      ) {
        throw new TypeError();
      }
      const signature = await provider.current.request({
        method: "personal_sign",
        params: [challenge.message, address],
      });
      if (typeof signature !== "string" || !signaturePattern.test(signature)) throw new TypeError();
      const verifyResponse = await fetch(verifyEndpoint, {
        body: JSON.stringify({
          message: challenge.message,
          requestId: challenge.requestId,
          signature,
        }),
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          ...protectedHeaders,
        },
        method: "POST",
      });
      if (!verifyResponse.ok) throw new TypeError();
      const result = (await verifyResponse.json()) as unknown;
      if (!isRecord(result) || result.schemaVersion !== 1 || result.purpose !== mode) {
        throw new TypeError();
      }
      if (mode === "sign_in") {
        if (result.redirectTo !== "/en/account") throw new TypeError();
        window.location.assign(result.redirectTo);
        return;
      }
      setPhase("linked");
      await loadWallets();
    } catch (error) {
      const code = isRecord(error) && typeof error.code === "number" ? error.code : null;
      setPhase(code === 4001 ? "rejected" : "error");
    }
  };

  const removeWallet = async (wallet: WalletSummary): Promise<void> => {
    if (csrfToken === null || csrfToken === undefined || !window.confirm(messages.removeConfirm)) {
      return;
    }
    setPhase("loading");
    try {
      const response = await fetch(`${walletsEndpoint}/${wallet.id}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { "x-csrf-token": csrfToken },
        method: "DELETE",
      });
      if (response.status !== 204) throw new TypeError();
      setPhase("linked");
      await loadWallets();
    } catch {
      setPhase("error");
    }
  };

  const alert =
    phase === "error"
      ? messages.error
      : phase === "linked"
        ? wallets.length === 0
          ? messages.removed
          : messages.linked
        : phase === "no-provider"
          ? messages.noProvider
          : phase === "rejected"
            ? messages.rejected
            : phase === "wrong-chain"
              ? messages.wrongChain
              : null;

  return (
    <section aria-labelledby={`wallet-${mode}-title`} className={styles.walletPanel}>
      <h2 id={`wallet-${mode}-title`}>{messages.title}</h2>
      <p>{messages.description}</p>
      {available === false ? <p className="privacy-note">{messages.noProvider}</p> : null}
      <Button
        label={messages.action}
        {...(phase === "loading" ? { loading: true, loadingLabel: messages.signing } : {})}
        onPress={() => void execute()}
        tone="secondary"
      />
      {alert === null ? null : (
        <InlineAlert
          live="polite"
          message={alert}
          title={phase === "linked" ? messages.linkedTitle : messages.title}
          tone={phase === "linked" ? "success" : phase === "error" ? "error" : "warning"}
        />
      )}
      {mode === "link_wallet" ? (
        <div className={styles.walletList}>
          {walletsLoading ? (
            <div aria-busy="true">
              <p>{messages.loading}</p>
              <Skeleton lines={1} />
            </div>
          ) : walletsError ? (
            <InlineAlert message={messages.error} title={messages.title} tone="error" />
          ) : wallets.length === 0 ? (
            <p>{messages.empty}</p>
          ) : (
            <ul>
              {wallets.map((wallet) => (
                <li key={wallet.id}>
                  <span>{walletLabel(wallet.address)} · Base Sepolia</span>
                  <Button
                    label={messages.remove}
                    onPress={() => void removeWallet(wallet)}
                    tone="danger"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
