import { StatePattern, type StatePatternComponentProps } from "@rituvia/ui";
import type { ReactNode } from "react";

export type ResilientStateProps = StatePatternComponentProps;

export function ResilientState(props: ResilientStateProps): ReactNode {
  return <StatePattern {...props} />;
}
