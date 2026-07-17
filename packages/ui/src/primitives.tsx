import * as React from "react";
import type { ChangeEvent, MouseEvent, ReactNode } from "react";

import {
  assertAccessibleLabel,
  createLocalActionHref,
  createUiControlId,
  createUiControlName,
  createUiControlValue,
  type LocalActionHref,
  type UiControlId,
  type UiControlName,
  type UiControlValue,
} from "./contracts.js";

export type ActionVariant = "primary" | "quiet" | "secondary";
export type ButtonTone = ActionVariant | "danger";
export type IconName =
  "back" | "check" | "close" | "error" | "forward" | "info" | "menu" | "warning";
export type AlertTone = "error" | "info" | "success" | "warning";
export type LiveMode = "assertive" | "off" | "polite";
export type TextAutoComplete = "email" | "name" | "off" | "on" | "tel" | "url" | "username";
export type TextAreaAutoComplete = "off" | "on";
export type TextDirection = "auto" | "ltr" | "rtl";
export type TextInputMode = "decimal" | "email" | "numeric" | "search" | "tel" | "text" | "url";
export type TextInputType = "email" | "search" | "tel" | "text" | "url";

const actionVariants = new Set<string>(["primary", "quiet", "secondary"]);
const buttonTones = new Set<string>([...actionVariants, "danger"]);
const buttonTypes = new Set<string>(["button", "reset", "submit"]);
const iconNames = new Set<string>([
  "back",
  "check",
  "close",
  "error",
  "forward",
  "info",
  "menu",
  "warning",
]);
const alertTones = new Set<string>(["error", "info", "success", "warning"]);
const liveModes = new Set<string>(["assertive", "off", "polite"]);
const textAutoCompletes = new Set<string>(["email", "name", "off", "on", "tel", "url", "username"]);
const textAreaAutoCompletes = new Set<string>(["off", "on"]);
const textDirections = new Set<string>(["auto", "ltr", "rtl"]);
const textInputModes = new Set<string>([
  "decimal",
  "email",
  "numeric",
  "search",
  "tel",
  "text",
  "url",
]);
const textInputTypes = new Set<string>(["email", "search", "tel", "text", "url"]);

const assertClosedValue = <Value extends string>(
  value: Value,
  allowed: ReadonlySet<string>,
  label: string,
): Value => {
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new TypeError(`${label} is outside the reviewed value set.`);
  }
  return value;
};

const assertBoundedInteger = (
  value: number,
  minimum: number,
  maximum: number,
  label: string,
): number => {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new TypeError(`${label} must be an integer from ${minimum} through ${maximum}.`);
  }
  return value;
};

const optionalBoundedInteger = (
  value: number | undefined,
  minimum: number,
  maximum: number,
  label: string,
): number | undefined =>
  value === undefined ? undefined : assertBoundedInteger(value, minimum, maximum, label);

type LoadingState =
  | Readonly<{ loading?: false; loadingLabel?: never }>
  | Readonly<{ loading: true; loadingLabel: string }>;

type RequiredState =
  | Readonly<{ required?: false; requiredLabel?: never }>
  | Readonly<{ required: true; requiredLabel: string }>;

type ValueState<Value> =
  | Readonly<{
      defaultValue?: Value;
      onValueChange?: (value: string) => void;
      value?: never;
    }>
  | Readonly<{
      defaultValue?: never;
      onValueChange: (value: string) => void;
      value: Value;
    }>;

type TextValueState =
  | (ValueState<string> & Readonly<{ readOnly?: false }>)
  | Readonly<{
      defaultValue?: never;
      onValueChange?: never;
      readOnly: true;
      value: string;
    }>
  | Readonly<{
      defaultValue?: string;
      onValueChange?: never;
      readOnly: true;
      value?: never;
    }>;

type CheckedState =
  | Readonly<{
      checked?: never;
      defaultChecked?: boolean;
      onCheckedChange?: (checked: boolean) => void;
    }>
  | Readonly<{
      checked: boolean;
      defaultChecked?: never;
      onCheckedChange: (checked: boolean) => void;
    }>;

type SharedFieldContent = Readonly<{
  description?: string;
  disabled?: boolean;
  error?: string;
  id: UiControlId;
  label: string;
}> &
  RequiredState;

const iconGlyph = (name: IconName): string => {
  switch (name) {
    case "back":
      return "←";
    case "check":
      return "✓";
    case "close":
    case "error":
      return "×";
    case "forward":
      return "→";
    case "info":
      return "i";
    case "menu":
      return "≡";
    case "warning":
      return "!";
  }
};

const supportControlId = (
  id: UiControlId,
  suffix: "description" | "error" | `option-${number}`,
): UiControlId => createUiControlId(`${id}-${suffix}`);

const describedBy = (id: UiControlId, description?: string, error?: string): string | undefined => {
  const references = [];
  if (description !== undefined) references.push(supportControlId(id, "description"));
  if (error !== undefined) references.push(supportControlId(id, "error"));
  return references.length === 0 ? undefined : references.join(" ");
};

const checkedState = (checked: boolean | undefined, defaultChecked: boolean | undefined): string =>
  checked === true || defaultChecked === true ? "checked" : "unchecked";

const assertControlledState = (
  controlledValue: unknown,
  initialValue: unknown,
  hasChangeHandler: boolean,
  readOnly: boolean,
  label: string,
): void => {
  if (controlledValue !== undefined && initialValue !== undefined) {
    throw new TypeError(`${label} cannot combine controlled and default values.`);
  }
  if (controlledValue !== undefined && !hasChangeHandler && !readOnly) {
    throw new TypeError(`${label} controlled values require a change callback.`);
  }
};

const optionalControlName = (value: UiControlName | undefined): UiControlName | undefined =>
  value === undefined ? undefined : createUiControlName(value);

const optionalControlValue = (value: UiControlValue | undefined): UiControlValue | undefined =>
  value === undefined ? undefined : createUiControlValue(value);

const assertOptions = (
  options: readonly { label: string; value: UiControlValue }[],
  label: string,
): void => {
  if (options.length === 0) throw new TypeError(`${label} requires at least one option.`);
  const values = new Set<string>();
  for (const option of options) {
    assertAccessibleLabel(option.label, `${label} option label`);
    const value = createUiControlValue(option.value);
    if (values.has(value)) throw new TypeError(`${label} option values must be unique.`);
    values.add(value);
  }
};

export type ActionLinkProps = Readonly<{
  children: string;
  href: LocalActionHref;
  variant?: ActionVariant;
}>;

export function ActionLink({ children, href, variant = "primary" }: ActionLinkProps): ReactNode {
  const target = createLocalActionHref(href);
  const reviewedVariant = assertClosedValue(variant, actionVariants, "Action link variant");
  assertAccessibleLabel(children, "Action link label");
  return (
    <a className={`rvt-action rvt-action--${reviewedVariant}`} href={target}>
      {children}
    </a>
  );
}

export type ButtonProps = Readonly<{
  disabled?: boolean;
  form?: UiControlId;
  label: string;
  name?: UiControlName;
  onPress?: () => void;
  tone?: ButtonTone;
  type?: "button" | "reset" | "submit";
  value?: UiControlValue;
}> &
  LoadingState;

export function Button({
  disabled = false,
  form,
  label,
  loading = false,
  loadingLabel,
  name,
  onPress,
  tone = "primary",
  type = "button",
  value,
}: ButtonProps): ReactNode {
  const accessibleLabel = assertAccessibleLabel(label, "Button label");
  const reviewedTone = assertClosedValue(tone, buttonTones, "Button tone");
  const reviewedType = assertClosedValue(type, buttonTypes, "Button type");
  const reviewedForm = form === undefined ? undefined : createUiControlId(form);
  const reviewedName = optionalControlName(name);
  const reviewedValue = optionalControlValue(value);
  const busyLabel = loading
    ? assertAccessibleLabel(loadingLabel ?? "", "Button loading label")
    : accessibleLabel;
  const unavailable = disabled || loading;
  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    if (unavailable) {
      event.preventDefault();
      return;
    }
    onPress?.();
  };

  return (
    <button
      aria-busy={loading || undefined}
      aria-label={busyLabel}
      className={`rvt-action rvt-action--${reviewedTone}`}
      data-state={loading ? "loading" : disabled ? "disabled" : "ready"}
      disabled={unavailable}
      form={reviewedForm}
      name={reviewedName}
      onClick={onPress === undefined ? undefined : handleClick}
      type={reviewedType}
      value={reviewedValue}
    >
      {loading ? <Spinner /> : null}
      <span aria-hidden="true">{busyLabel}</span>
    </button>
  );
}

export type IconProps = Readonly<{
  label?: string | undefined;
  name: IconName;
}>;

export function Icon({ label, name }: IconProps): ReactNode {
  const reviewedName = assertClosedValue(name, iconNames, "Icon name");
  const meaningfulLabel =
    label === undefined ? undefined : assertAccessibleLabel(label, "Icon label");
  return (
    <span
      aria-hidden={meaningfulLabel === undefined ? "true" : undefined}
      aria-label={meaningfulLabel}
      className={`rvt-icon rvt-icon--${reviewedName}`}
      role={meaningfulLabel === undefined ? undefined : "img"}
    >
      {iconGlyph(reviewedName)}
    </span>
  );
}

export type DirectionalIconProps = Readonly<{
  direction: "back" | "forward";
  label?: string | undefined;
}>;

export function DirectionalIcon({ direction, label }: DirectionalIconProps): ReactNode {
  return <Icon label={label} name={direction} />;
}

export type IconButtonProps = Readonly<{
  disabled?: boolean;
  icon: IconName;
  label: string;
  onPress?: () => void;
  tone?: ButtonTone;
  type?: "button" | "reset" | "submit";
}> &
  LoadingState;

export function IconButton({
  disabled = false,
  icon,
  label,
  loading = false,
  loadingLabel,
  onPress,
  tone = "quiet",
  type = "button",
}: IconButtonProps): ReactNode {
  const accessibleLabel = assertAccessibleLabel(label, "Icon button label");
  const reviewedIcon = assertClosedValue(icon, iconNames, "Icon button icon");
  const reviewedTone = assertClosedValue(tone, buttonTones, "Icon button tone");
  const reviewedType = assertClosedValue(type, buttonTypes, "Icon button type");
  const busyLabel = loading
    ? assertAccessibleLabel(loadingLabel ?? "", "Icon button loading label")
    : accessibleLabel;
  const unavailable = disabled || loading;
  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    if (unavailable) {
      event.preventDefault();
      return;
    }
    onPress?.();
  };

  return (
    <button
      aria-busy={loading || undefined}
      aria-label={busyLabel}
      className={`rvt-icon-button rvt-icon-button--${reviewedTone}`}
      data-state={loading ? "loading" : disabled ? "disabled" : "ready"}
      disabled={unavailable}
      onClick={onPress === undefined ? undefined : handleClick}
      type={reviewedType}
    >
      {loading ? <Spinner /> : <Icon name={reviewedIcon} />}
    </button>
  );
}

export type FieldProps = Readonly<{ children: ReactNode }>;

export function Field({ children }: FieldProps): ReactNode {
  return <div className="rvt-field">{children}</div>;
}

export type FieldLabelProps = Readonly<{
  children: string;
  htmlFor: UiControlId;
  requiredLabel?: string | undefined;
}>;

export function FieldLabel({ children, htmlFor, requiredLabel }: FieldLabelProps): ReactNode {
  assertAccessibleLabel(children, "Field label");
  if (requiredLabel !== undefined) assertAccessibleLabel(requiredLabel, "Required label");
  const reviewedHtmlFor = createUiControlId(htmlFor);
  return (
    <label className="rvt-field__label" htmlFor={reviewedHtmlFor}>
      {children}
      {requiredLabel === undefined ? null : (
        <span className="rvt-field__required">{` ${requiredLabel}`}</span>
      )}
    </label>
  );
}

export type FieldDescriptionProps = Readonly<{ children: string; id: UiControlId }>;

export function FieldDescription({ children, id }: FieldDescriptionProps): ReactNode {
  assertAccessibleLabel(children, "Field description");
  const reviewedId = createUiControlId(id);
  return (
    <span className="rvt-field__description" id={reviewedId}>
      {children}
    </span>
  );
}

export type FieldErrorMessageProps = Readonly<{ children: string; id: UiControlId }>;

export function FieldErrorMessage({ children, id }: FieldErrorMessageProps): ReactNode {
  assertAccessibleLabel(children, "Field error");
  const reviewedId = createUiControlId(id);
  return (
    <span className="rvt-field__error" id={reviewedId}>
      <Icon name="error" />
      {children}
    </span>
  );
}

type FieldSupportProps = Readonly<{
  description: string | undefined;
  error: string | undefined;
  id: UiControlId;
}>;

const FieldSupport = ({ description, error, id }: FieldSupportProps): ReactNode => (
  <>
    {description === undefined ? null : (
      <FieldDescription id={supportControlId(id, "description")}>{description}</FieldDescription>
    )}
    {error === undefined ? null : (
      <FieldErrorMessage id={supportControlId(id, "error")}>{error}</FieldErrorMessage>
    )}
  </>
);

export type TextFieldProps = SharedFieldContent &
  Readonly<{
    autoComplete?: TextAutoComplete;
    dir?: TextDirection;
    inputMode?: TextInputMode;
    maxLength?: number;
    name?: UiControlName;
    placeholder?: string;
    type?: TextInputType;
  }> &
  TextValueState;

export function TextField({
  autoComplete = "off",
  defaultValue,
  description,
  disabled = false,
  dir = "auto",
  error,
  id,
  inputMode,
  label,
  maxLength,
  name,
  onValueChange,
  placeholder,
  readOnly = false,
  required = false,
  requiredLabel,
  type = "text",
  value,
}: TextFieldProps): ReactNode {
  assertControlledState(value, defaultValue, onValueChange !== undefined, readOnly, "Text field");
  const reviewedId = createUiControlId(id);
  const reviewedName = optionalControlName(name);
  const reviewedAutoComplete = assertClosedValue(
    autoComplete,
    textAutoCompletes,
    "Text field autocomplete",
  );
  const reviewedDirection = assertClosedValue(dir, textDirections, "Text field direction");
  const reviewedInputMode =
    inputMode === undefined
      ? undefined
      : assertClosedValue(inputMode, textInputModes, "Text field input mode");
  const reviewedMaxLength = optionalBoundedInteger(maxLength, 1, 65_535, "Text field maxLength");
  const reviewedType = assertClosedValue(type, textInputTypes, "Text field type");
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onValueChange?.(event.currentTarget.value);
  };
  return (
    <Field>
      <FieldLabel htmlFor={reviewedId} requiredLabel={required ? requiredLabel : undefined}>
        {label}
      </FieldLabel>
      <input
        aria-describedby={describedBy(reviewedId, description, error)}
        aria-errormessage={error === undefined ? undefined : supportControlId(reviewedId, "error")}
        aria-invalid={error === undefined ? undefined : "true"}
        autoComplete={reviewedAutoComplete}
        className="rvt-field__control"
        defaultValue={defaultValue}
        disabled={disabled}
        dir={reviewedDirection}
        id={reviewedId}
        inputMode={reviewedInputMode}
        maxLength={reviewedMaxLength}
        name={reviewedName}
        onChange={onValueChange === undefined ? undefined : handleChange}
        placeholder={placeholder}
        readOnly={readOnly}
        required={required}
        type={reviewedType}
        value={value}
      />
      <FieldSupport description={description} error={error} id={reviewedId} />
    </Field>
  );
}

export type TextAreaFieldProps = SharedFieldContent &
  Readonly<{
    autoComplete?: TextAreaAutoComplete;
    dir?: TextDirection;
    maxLength?: number;
    name?: UiControlName;
    placeholder?: string;
    rows?: number;
  }> &
  TextValueState;

export function TextAreaField({
  autoComplete = "off",
  defaultValue,
  description,
  disabled = false,
  dir = "auto",
  error,
  id,
  label,
  maxLength,
  name,
  onValueChange,
  placeholder,
  readOnly = false,
  required = false,
  requiredLabel,
  rows = 4,
  value,
}: TextAreaFieldProps): ReactNode {
  assertControlledState(
    value,
    defaultValue,
    onValueChange !== undefined,
    readOnly,
    "Textarea field",
  );
  const reviewedId = createUiControlId(id);
  const reviewedName = optionalControlName(name);
  const reviewedAutoComplete = assertClosedValue(
    autoComplete,
    textAreaAutoCompletes,
    "Textarea autocomplete",
  );
  const reviewedDirection = assertClosedValue(dir, textDirections, "Textarea direction");
  const reviewedMaxLength = optionalBoundedInteger(maxLength, 1, 65_535, "Textarea maxLength");
  const reviewedRows = assertBoundedInteger(rows, 1, 24, "Textarea rows");
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    onValueChange?.(event.currentTarget.value);
  };
  return (
    <Field>
      <FieldLabel htmlFor={reviewedId} requiredLabel={required ? requiredLabel : undefined}>
        {label}
      </FieldLabel>
      <textarea
        aria-describedby={describedBy(reviewedId, description, error)}
        aria-errormessage={error === undefined ? undefined : supportControlId(reviewedId, "error")}
        aria-invalid={error === undefined ? undefined : "true"}
        autoComplete={reviewedAutoComplete}
        className="rvt-field__control rvt-field__control--textarea"
        defaultValue={defaultValue}
        disabled={disabled}
        dir={reviewedDirection}
        id={reviewedId}
        maxLength={reviewedMaxLength}
        name={reviewedName}
        onChange={onValueChange === undefined ? undefined : handleChange}
        placeholder={placeholder}
        readOnly={readOnly}
        required={required}
        rows={reviewedRows}
        value={value}
      />
      <FieldSupport description={description} error={error} id={reviewedId} />
    </Field>
  );
}

export type SelectOption = Readonly<{
  disabled?: boolean;
  label: string;
  value: UiControlValue;
}>;

export type SelectFieldProps = SharedFieldContent &
  Readonly<{
    name?: UiControlName;
    options: readonly SelectOption[];
  }> &
  ValueState<UiControlValue>;

export function SelectField({
  defaultValue,
  description,
  disabled = false,
  error,
  id,
  label,
  name,
  onValueChange,
  options,
  required = false,
  requiredLabel,
  value,
}: SelectFieldProps): ReactNode {
  assertOptions(options, "Select field");
  const reviewedId = createUiControlId(id);
  const reviewedName = optionalControlName(name);
  const reviewedDefaultValue = optionalControlValue(defaultValue);
  const reviewedValue = optionalControlValue(value);
  assertControlledState(
    reviewedValue,
    reviewedDefaultValue,
    onValueChange !== undefined,
    false,
    "Select field",
  );
  const handleChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    onValueChange?.(event.currentTarget.value);
  };
  return (
    <Field>
      <FieldLabel htmlFor={reviewedId} requiredLabel={required ? requiredLabel : undefined}>
        {label}
      </FieldLabel>
      <select
        aria-describedby={describedBy(reviewedId, description, error)}
        aria-errormessage={error === undefined ? undefined : supportControlId(reviewedId, "error")}
        aria-invalid={error === undefined ? undefined : "true"}
        className="rvt-field__control rvt-field__control--select"
        defaultValue={reviewedDefaultValue}
        disabled={disabled}
        id={reviewedId}
        name={reviewedName}
        onChange={onValueChange === undefined ? undefined : handleChange}
        required={required}
        value={reviewedValue}
      >
        {options.map((option) => (
          <option disabled={option.disabled} key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldSupport description={description} error={error} id={reviewedId} />
    </Field>
  );
}

type ChoiceContent = SharedFieldContent &
  Readonly<{
    name?: UiControlName;
    value?: UiControlValue;
  }> &
  CheckedState;

type CheckboxMixedState =
  | (CheckedState & Readonly<{ mixed?: false }>)
  | Readonly<{
      checked?: never;
      defaultChecked?: never;
      disabled?: false;
      mixed: true;
      onCheckedChange: (checked: boolean) => void;
    }>
  | Readonly<{
      checked?: never;
      defaultChecked?: never;
      disabled: true;
      mixed: true;
      onCheckedChange?: never;
    }>;

export type CheckboxProps = Omit<ChoiceContent, keyof CheckedState> & CheckboxMixedState;

export function Checkbox({
  checked,
  defaultChecked,
  description,
  disabled = false,
  error,
  id,
  label,
  mixed = false,
  name,
  onCheckedChange,
  required = false,
  requiredLabel,
  value,
}: CheckboxProps): ReactNode {
  assertAccessibleLabel(label, "Checkbox label");
  if (required) assertAccessibleLabel(requiredLabel ?? "", "Checkbox required label");
  if (mixed && (checked !== undefined || defaultChecked !== undefined)) {
    throw new TypeError("Mixed checkboxes cannot combine checked or defaultChecked state.");
  }
  if (mixed && !disabled && onCheckedChange === undefined) {
    throw new TypeError("Interactive mixed checkboxes require a change callback.");
  }
  assertControlledState(checked, defaultChecked, onCheckedChange !== undefined, false, "Checkbox");
  const reviewedId = createUiControlId(id);
  const reviewedName = optionalControlName(name);
  const reviewedValue = optionalControlValue(value);
  const state = mixed ? "mixed" : checkedState(checked, defaultChecked);
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onCheckedChange?.(event.currentTarget.checked);
  };
  return (
    <Field>
      <label className="rvt-choice" data-state={state} htmlFor={reviewedId}>
        <input
          aria-checked={mixed ? "mixed" : checked}
          aria-describedby={describedBy(reviewedId, description, error)}
          aria-errormessage={
            error === undefined ? undefined : supportControlId(reviewedId, "error")
          }
          aria-invalid={error === undefined ? undefined : "true"}
          checked={mixed ? false : checked}
          className="rvt-choice__input"
          defaultChecked={mixed ? undefined : defaultChecked}
          disabled={disabled}
          id={reviewedId}
          name={reviewedName}
          onChange={onCheckedChange === undefined ? undefined : handleChange}
          required={required}
          type="checkbox"
          value={reviewedValue}
        />
        <span aria-hidden="true" className="rvt-choice__indicator" />
        <span className="rvt-choice__label">
          {label}
          {required ? <span className="rvt-field__required">{` ${requiredLabel}`}</span> : null}
        </span>
      </label>
      <FieldSupport description={description} error={error} id={reviewedId} />
    </Field>
  );
}

export type SwitchProps = ChoiceContent;

export function Switch({
  checked,
  defaultChecked,
  description,
  disabled = false,
  error,
  id,
  label,
  name,
  onCheckedChange,
  required = false,
  requiredLabel,
  value,
}: SwitchProps): ReactNode {
  assertAccessibleLabel(label, "Switch label");
  if (required) assertAccessibleLabel(requiredLabel ?? "", "Switch required label");
  assertControlledState(checked, defaultChecked, onCheckedChange !== undefined, false, "Switch");
  const reviewedId = createUiControlId(id);
  const reviewedName = optionalControlName(name);
  const reviewedValue = optionalControlValue(value);
  const state = checkedState(checked, defaultChecked);
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onCheckedChange?.(event.currentTarget.checked);
  };
  return (
    <Field>
      <label className="rvt-switch" data-state={state} htmlFor={reviewedId}>
        <input
          aria-checked={checked}
          aria-describedby={describedBy(reviewedId, description, error)}
          aria-errormessage={
            error === undefined ? undefined : supportControlId(reviewedId, "error")
          }
          aria-invalid={error === undefined ? undefined : "true"}
          checked={checked}
          className="rvt-switch__input"
          defaultChecked={defaultChecked}
          disabled={disabled}
          id={reviewedId}
          name={reviewedName}
          onChange={onCheckedChange === undefined ? undefined : handleChange}
          required={required}
          role="switch"
          type="checkbox"
          value={reviewedValue}
        />
        <span aria-hidden="true" className="rvt-switch__track">
          <span className="rvt-switch__thumb" />
        </span>
        <span className="rvt-switch__label">
          {label}
          {required ? <span className="rvt-field__required">{` ${requiredLabel}`}</span> : null}
        </span>
      </label>
      <FieldSupport description={description} error={error} id={reviewedId} />
    </Field>
  );
}

export type RadioOption = Readonly<{
  disabled?: boolean;
  label: string;
  value: UiControlValue;
}>;

type RadioValueState =
  | Readonly<{
      defaultValue?: UiControlValue;
      onValueChange?: (value: string) => void;
      value?: never;
    }>
  | Readonly<{
      defaultValue?: never;
      onValueChange: (value: string) => void;
      value: UiControlValue | undefined;
    }>;

export type RadioGroupProps = Readonly<{
  description?: string;
  disabled?: boolean;
  error?: string;
  id: UiControlId;
  label: string;
  name: UiControlName;
  options: readonly RadioOption[];
}> &
  RequiredState &
  RadioValueState;

export function RadioGroup({
  defaultValue,
  description,
  disabled = false,
  error,
  id,
  label,
  name,
  onValueChange,
  options,
  required = false,
  requiredLabel,
  value,
}: RadioGroupProps): ReactNode {
  assertAccessibleLabel(label, "Radio group label");
  if (required) assertAccessibleLabel(requiredLabel ?? "", "Radio group required label");
  assertOptions(options, "Radio group");
  const reviewedId = createUiControlId(id);
  const reviewedName = createUiControlName(name);
  const reviewedDefaultValue = optionalControlValue(defaultValue);
  const reviewedValue = optionalControlValue(value);
  assertControlledState(
    reviewedValue,
    reviewedDefaultValue,
    onValueChange !== undefined,
    false,
    "Radio group",
  );
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onValueChange?.(event.currentTarget.value);
  };
  return (
    <fieldset
      aria-describedby={describedBy(reviewedId, description, error)}
      aria-errormessage={error === undefined ? undefined : supportControlId(reviewedId, "error")}
      aria-invalid={error === undefined ? undefined : "true"}
      className="rvt-field rvt-radio-group"
      disabled={disabled}
    >
      <legend className="rvt-field__label">
        {label}
        {required ? <span className="rvt-field__required">{` ${requiredLabel}`}</span> : null}
      </legend>
      <div className="rvt-radio-group__options">
        {options.map((option, index) => {
          const optionId = supportControlId(reviewedId, `option-${index + 1}`);
          return (
            <label className="rvt-choice rvt-choice--radio" htmlFor={optionId} key={option.value}>
              <input
                checked={onValueChange === undefined ? undefined : reviewedValue === option.value}
                className="rvt-choice__input"
                defaultChecked={
                  reviewedDefaultValue === undefined
                    ? undefined
                    : reviewedDefaultValue === option.value
                }
                disabled={option.disabled}
                id={optionId}
                name={reviewedName}
                onChange={onValueChange === undefined ? undefined : handleChange}
                required={required}
                type="radio"
                value={option.value}
              />
              <span aria-hidden="true" className="rvt-choice__indicator" />
              <span className="rvt-choice__label">{option.label}</span>
            </label>
          );
        })}
      </div>
      <FieldSupport description={description} error={error} id={reviewedId} />
    </fieldset>
  );
}

export type InlineAlertProps = Readonly<{
  live?: LiveMode;
  message: string;
  title: string;
  tone?: AlertTone;
}>;

export function InlineAlert({
  live = "off",
  message,
  title,
  tone = "info",
}: InlineAlertProps): ReactNode {
  assertAccessibleLabel(title, "Alert title");
  assertAccessibleLabel(message, "Alert message");
  const reviewedTone = assertClosedValue(tone, alertTones, "Alert tone");
  const reviewedLive = assertClosedValue(live, liveModes, "Alert live mode");
  const iconName: IconName =
    reviewedTone === "success" ? "check" : reviewedTone === "error" ? "error" : reviewedTone;
  return (
    <div
      aria-live={reviewedLive === "off" ? undefined : reviewedLive}
      className={`rvt-alert rvt-alert--${reviewedTone}`}
      role={
        reviewedLive === "assertive" ? "alert" : reviewedLive === "polite" ? "status" : undefined
      }
    >
      <Icon name={iconName} />
      <div>
        <p className="rvt-alert__title">{title}</p>
        <p className="rvt-alert__message">{message}</p>
      </div>
    </div>
  );
}

export type SpinnerProps = Readonly<{ label?: string }>;

export function Spinner({ label }: SpinnerProps = {}): ReactNode {
  if (label !== undefined) assertAccessibleLabel(label, "Spinner label");
  return (
    <span
      aria-hidden={label === undefined ? "true" : undefined}
      aria-label={label}
      className="rvt-spinner"
      role={label === undefined ? undefined : "status"}
    />
  );
}

export type SkeletonProps = Readonly<{
  lines?: 1 | 2 | 3 | 4;
}>;

export function Skeleton({ lines = 1 }: SkeletonProps): ReactNode {
  if (!Number.isInteger(lines) || lines < 1 || lines > 4) {
    throw new TypeError("Skeleton lines must be an integer from one through four.");
  }
  return (
    <span aria-hidden="true" className="rvt-skeleton" data-lines={String(lines)}>
      {Array.from({ length: lines }, (_, index) => (
        <span className="rvt-skeleton__line" key={index} />
      ))}
    </span>
  );
}

export type VisuallyHiddenProps = Readonly<{ children: string }>;

export function VisuallyHidden({ children }: VisuallyHiddenProps): ReactNode {
  assertAccessibleLabel(children, "Visually hidden text");
  return <span className="rvt-visually-hidden">{children}</span>;
}

export type StatePatternKind = "empty" | "error" | "offline" | "provider-unavailable";
export type StatePatternTitleElement = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p";

type StateButtonAction =
  | Readonly<{
      kind: "button";
      label: string;
      loading?: false;
      loadingLabel?: never;
      onPress: () => void;
    }>
  | Readonly<{
      kind: "button";
      label: string;
      loading: true;
      loadingLabel: string;
      onPress: () => void;
    }>;

export type StatePatternAction =
  | Readonly<{
      href: LocalActionHref;
      kind: "link";
      label: string;
    }>
  | StateButtonAction;

type StatePatternActions =
  | Readonly<{
      primaryAction?: never;
      secondaryAction?: never;
    }>
  | Readonly<{
      primaryAction: StatePatternAction;
      secondaryAction?: StatePatternAction;
    }>;

type StatePatternContent = Readonly<{
  message: string;
  title: string;
  titleAs?: StatePatternTitleElement;
  titleId: UiControlId;
}> &
  StatePatternActions;

export type StatePatternProps = StatePatternContent &
  Readonly<{ live?: Exclude<LiveMode, "assertive"> }>;
export type ErrorStateProps = StatePatternContent & Readonly<{ live?: LiveMode }>;
export type StatePatternComponentProps =
  | (StatePatternProps &
      Readonly<{
        kind: Exclude<StatePatternKind, "error">;
      }>)
  | (ErrorStateProps & Readonly<{ kind: "error" }>);

const statePatternKinds = new Set<string>(["empty", "error", "offline", "provider-unavailable"]);
const statePatternTitleElements = new Set<string>(["h1", "h2", "h3", "h4", "h5", "h6", "p"]);

const assertStatePatternKind = (value: StatePatternKind): StatePatternKind => {
  if (typeof value !== "string" || !statePatternKinds.has(value)) {
    throw new TypeError("State pattern kind is outside the reviewed value set.");
  }
  return value;
};

const assertStatePatternTitleElement = (
  value: StatePatternTitleElement,
): StatePatternTitleElement => {
  if (typeof value !== "string" || !statePatternTitleElements.has(value)) {
    throw new TypeError("State pattern title element is outside the reviewed value set.");
  }
  return value;
};

const statePatternIcon = (kind: StatePatternKind): IconName => {
  switch (kind) {
    case "empty":
      return "info";
    case "error":
      return "error";
    case "offline":
    case "provider-unavailable":
      return "warning";
  }
};

const statePatternTitle = (
  children: string,
  id: UiControlId,
  titleAs: StatePatternTitleElement,
): ReactNode => {
  if (titleAs === "h1") {
    return (
      <h1 className="rvt-state-pattern__title" id={id} tabIndex={-1}>
        {children}
      </h1>
    );
  }
  if (titleAs === "h2") {
    return (
      <h2 className="rvt-state-pattern__title" id={id} tabIndex={-1}>
        {children}
      </h2>
    );
  }
  if (titleAs === "h3") {
    return (
      <h3 className="rvt-state-pattern__title" id={id} tabIndex={-1}>
        {children}
      </h3>
    );
  }
  if (titleAs === "h4") {
    return (
      <h4 className="rvt-state-pattern__title" id={id} tabIndex={-1}>
        {children}
      </h4>
    );
  }
  if (titleAs === "h5") {
    return (
      <h5 className="rvt-state-pattern__title" id={id} tabIndex={-1}>
        {children}
      </h5>
    );
  }
  if (titleAs === "h6") {
    return (
      <h6 className="rvt-state-pattern__title" id={id} tabIndex={-1}>
        {children}
      </h6>
    );
  }
  return (
    <p className="rvt-state-pattern__title" id={id} tabIndex={-1}>
      {children}
    </p>
  );
};

const statePatternAction = (
  action: StatePatternAction,
  variant: "primary" | "secondary",
): ReactNode => {
  assertAccessibleLabel(action.label, "State pattern action label");
  if (action.kind === "link") {
    return ActionLink({
      children: action.label,
      href: createLocalActionHref(action.href),
      variant,
    });
  }
  if (action.kind !== "button" || typeof action.onPress !== "function") {
    throw new TypeError("State pattern actions must be reviewed links or buttons.");
  }
  return action.loading === true
    ? Button({
        label: action.label,
        loading: true,
        loadingLabel: action.loadingLabel,
        onPress: action.onPress,
        tone: variant,
      })
    : Button({ label: action.label, onPress: action.onPress, tone: variant });
};

const statePattern = ({
  kind,
  live = "off",
  message,
  primaryAction,
  secondaryAction,
  title,
  titleAs = "h2",
  titleId,
}: StatePatternComponentProps): ReactNode => {
  const reviewedKind = assertStatePatternKind(kind);
  const reviewedLive = assertClosedValue(live, liveModes, "State pattern live mode");
  const reviewedTitleElement = assertStatePatternTitleElement(titleAs);
  const reviewedTitleId = createUiControlId(titleId);
  assertAccessibleLabel(title, "State pattern title");
  assertAccessibleLabel(message, "State pattern message");
  if (reviewedLive === "assertive" && reviewedKind !== "error") {
    throw new TypeError("Only error state patterns may use assertive announcements.");
  }
  if (secondaryAction !== undefined && primaryAction === undefined) {
    throw new TypeError("State pattern secondary actions require a primary action.");
  }
  const role =
    reviewedLive === "assertive" ? "alert" : reviewedLive === "polite" ? "status" : undefined;

  return (
    <section
      aria-labelledby={reviewedTitleId}
      className={`rvt-state-pattern rvt-state-pattern--${reviewedKind}`}
      data-kind={reviewedKind}
    >
      <div
        aria-atomic={role === undefined ? undefined : "true"}
        aria-live={reviewedLive === "off" ? undefined : reviewedLive}
        className="rvt-state-pattern__announcement"
        role={role}
      >
        <div aria-hidden="true" className="rvt-state-pattern__icon">
          {Icon({ name: statePatternIcon(reviewedKind) })}
        </div>
        <div className="rvt-state-pattern__body">
          {statePatternTitle(title, reviewedTitleId, reviewedTitleElement)}
          <p className="rvt-state-pattern__message">{message}</p>
        </div>
      </div>
      {primaryAction === undefined && secondaryAction === undefined ? null : (
        <div className="rvt-state-pattern__actions">
          {primaryAction === undefined ? null : statePatternAction(primaryAction, "primary")}
          {secondaryAction === undefined ? null : statePatternAction(secondaryAction, "secondary")}
        </div>
      )}
    </section>
  );
};

export const StatePattern = (props: StatePatternComponentProps): ReactNode => statePattern(props);

export const EmptyState = (props: StatePatternProps): ReactNode =>
  statePattern({ ...props, kind: "empty" });

export const ErrorState = (props: ErrorStateProps): ReactNode =>
  statePattern({ ...props, kind: "error" });

export const OfflineState = (props: StatePatternProps): ReactNode =>
  statePattern({ ...props, kind: "offline" });

export const ProviderUnavailableState = (props: StatePatternProps): ReactNode =>
  statePattern({ ...props, kind: "provider-unavailable" });
