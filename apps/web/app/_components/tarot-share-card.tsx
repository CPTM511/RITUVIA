"use client";

import { Button, Checkbox, createUiControlId } from "@rituvia/ui";
import Image from "next/image";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { formatCoreMessage } from "../_i18n/core-messages";
import type { TarotShareMessages } from "../_i18n/tarot-one-card-messages";
import type { Locale } from "../_i18n/routing";
import {
  createTarotShareCardProjection,
  createTarotShareCardText,
  serializeTarotShareCardSvg,
} from "./tarot-share-card-artifact";

export type TarotShareCardProps = Readonly<{
  brandName: string;
  canonicalUrl: string;
  cardTitle: string;
  locale: Locale;
  messages: TarotShareMessages;
  orientationLabel: string;
  themeLabel: string;
}>;

type ShareStatus = "downloaded" | "error" | "idle" | "shared";

const shareThemeControlId = createUiControlId("tarot-share-theme");
const subscribeToHydration = (): (() => void) => () => undefined;

const supportsNativeFileShare = (svg: string, fileName: string): boolean => {
  if (
    typeof File !== "function" ||
    typeof navigator.share !== "function" ||
    typeof navigator.canShare !== "function"
  ) {
    return false;
  }
  try {
    return navigator.canShare({
      files: [new File([svg], fileName, { type: "image/svg+xml" })],
    });
  } catch {
    return false;
  }
};

export function TarotShareCard({
  brandName,
  canonicalUrl,
  cardTitle,
  locale,
  messages,
  orientationLabel,
  themeLabel,
}: TarotShareCardProps) {
  const [includeTheme, setIncludeTheme] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [status, setStatus] = useState<ShareStatus>("idle");
  const projection = useMemo(
    () =>
      createTarotShareCardProjection({
        altText: formatCoreMessage(locale, "tarot.share.altText", {
          brand: brandName,
          cardTitle,
          orientation: orientationLabel,
          theme: themeLabel,
          themeVisibility: includeTheme ? "included" : "hidden",
        }),
        boundary: messages.boundary,
        brandName,
        canonicalUrl,
        cardTitle,
        genericReflection: messages.genericReflection,
        includeTheme,
        locale,
        orientationLabel,
        themeFieldLabel: messages.themeFieldLabel,
        themeLabel,
      }),
    [
      brandName,
      canonicalUrl,
      cardTitle,
      includeTheme,
      locale,
      messages,
      orientationLabel,
      themeLabel,
    ],
  );
  const svg = projection === null ? null : serializeTarotShareCardSvg(projection);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const nativeShareAvailable = useMemo(
    () => hydrated && svg !== null && supportsNativeFileShare(svg, messages.fileName),
    [hydrated, messages.fileName, svg],
  );

  useEffect(() => {
    let active = true;
    if (!previewVisible || svg === null) {
      queueMicrotask(() => {
        if (active) setPreviewUrl(null);
      });
      return () => {
        active = false;
      };
    }
    const objectUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    queueMicrotask(() => {
      if (active) setPreviewUrl(objectUrl);
    });
    return () => {
      active = false;
      URL.revokeObjectURL(objectUrl);
    };
  }, [previewVisible, svg]);

  const download = (): void => {
    if (projection === null || svg === null) {
      setStatus("error");
      return;
    }
    const objectUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const anchor = document.createElement("a");
    anchor.download = messages.fileName;
    anchor.href = objectUrl;
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    setStatus("downloaded");
  };

  const share = async (): Promise<void> => {
    if (projection === null || svg === null || !supportsNativeFileShare(svg, messages.fileName)) {
      setStatus("error");
      return;
    }
    setSharing(true);
    setStatus("idle");
    try {
      const file = new File([svg], messages.fileName, { type: "image/svg+xml" });
      const filePayload = { files: [file] };
      if (!navigator.canShare(filePayload)) {
        setStatus("error");
        return;
      }
      await navigator.share({
        ...filePayload,
        text: createTarotShareCardText(projection),
        title: `${brandName} · ${messages.nativeShareTitle}`,
        url: projection.canonicalUrl,
      });
      setStatus("shared");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
    } finally {
      setSharing(false);
    }
  };

  const statusMessage =
    status === "downloaded"
      ? messages.downloaded
      : status === "shared"
        ? messages.shared
        : status === "error"
          ? messages.error
          : "";

  return (
    <section aria-labelledby="tarot-share-heading" className="tarot-share">
      <header>
        <p className="tarot-result-eyebrow">{messages.eyebrow}</p>
        <h3 id="tarot-share-heading">{messages.heading}</h3>
        <p>{messages.description}</p>
        <p className="tarot-share-privacy">{messages.privacy}</p>
      </header>
      <Checkbox
        checked={includeTheme}
        description={messages.themeDescription}
        id={shareThemeControlId}
        label={messages.includeTheme}
        onCheckedChange={(checked) => {
          setIncludeTheme(checked);
          setStatus("idle");
        }}
      />
      <div className="tarot-share-actions">
        <Button
          label={previewVisible ? messages.hidePreview : messages.preview}
          onPress={() => {
            setPreviewVisible((visible) => !visible);
            setStatus("idle");
          }}
          tone="secondary"
        />
      </div>
      {previewVisible ? (
        projection === null || svg === null ? (
          <p aria-live="polite" className="tarot-share-status" role="status">
            {messages.error}
          </p>
        ) : (
          <div className="tarot-share-preview">
            {previewUrl === null ? null : (
              <Image
                alt={projection.altText}
                className="tarot-share-card"
                height={630}
                src={previewUrl}
                unoptimized
                width={1200}
              />
            )}
            <p className="tarot-share-alt">
              <strong>{messages.altTextLabel}</strong> <span>{projection.altText}</span>
            </p>
            <div className="tarot-share-actions">
              <Button label={messages.download} onPress={download} tone="secondary" />
              {nativeShareAvailable ? (
                sharing ? (
                  <Button
                    label={messages.nativeShare}
                    loading
                    loadingLabel={messages.sharing}
                    onPress={() => undefined}
                  />
                ) : (
                  <Button label={messages.nativeShare} onPress={() => void share()} />
                )
              ) : null}
            </div>
          </div>
        )
      ) : null}
      <p aria-live="polite" className="tarot-share-status" role="status">
        {statusMessage}
      </p>
    </section>
  );
}
