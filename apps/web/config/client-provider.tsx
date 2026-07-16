"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { parseClientConfiguration, type ClientConfiguration } from "@rituvia/config/client";

const RuntimeConfigurationContext = createContext<ClientConfiguration | undefined>(undefined);

type RuntimeConfigurationProviderProps = Readonly<{
  children: ReactNode;
  configuration: ClientConfiguration;
}>;

export function RuntimeConfigurationProvider({
  children,
  configuration,
}: RuntimeConfigurationProviderProps) {
  const validatedConfiguration = useMemo(
    () => parseClientConfiguration(configuration),
    [configuration],
  );

  return (
    <RuntimeConfigurationContext.Provider value={validatedConfiguration}>
      {children}
    </RuntimeConfigurationContext.Provider>
  );
}

export function useRuntimeConfiguration(): ClientConfiguration {
  const configuration = useContext(RuntimeConfigurationContext);

  if (configuration === undefined) {
    throw new Error("Runtime configuration is unavailable outside its provider.");
  }

  return configuration;
}
