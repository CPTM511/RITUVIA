import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  ActionLink,
  Button,
  Checkbox,
  DirectionalIcon,
  Icon,
  IconButton,
  InlineAlert,
  RadioGroup,
  SelectField,
  Skeleton,
  Spinner,
  Switch,
  TextAreaField,
  TextField,
  createLocalActionHref,
  createUiControlId,
  createUiControlName,
  createUiControlValue,
  type ActionLinkProps,
  type ButtonProps,
  type CheckboxProps,
  type TextFieldProps,
} from "../src/index.js";

const fieldId = createUiControlId("reflection-question");
const fieldName = createUiControlName("reflection.question");
const firstValue = createUiControlValue("first-option");
const secondValue = createUiControlValue("second-option");

describe("accessible UI primitives", () => {
  it("renders a bounded local action link with no polymorphic or outbound surface", () => {
    const html = renderToStaticMarkup(
      <ActionLink href={createLocalActionHref("/en#practice")} variant="secondary">
        Begin reflection
      </ActionLink>,
    );

    expect(html).toBe(
      '<a class="rvt-action rvt-action--secondary" href="/en#practice">Begin reflection</a>',
    );
    const unsafe = {
      as: "script",
      children: "Private canary",
      dangerouslySetInnerHTML: { __html: "private-html-canary" },
      href: "javascript:alert(1)",
      onClick: "private-handler-canary",
      ping: "https://tracker.invalid",
      style: { background: "url(https://tracker.invalid)" },
      target: "_blank",
    } as unknown as ActionLinkProps;
    expect(() => renderToStaticMarkup(<ActionLink {...unsafe} />)).toThrow(TypeError);
  });

  it("defaults buttons to non-submit and suppresses disabled or loading activation", () => {
    const onPress = vi.fn();
    const ready = Button({ label: "Continue", onPress }) as ReactElement<{
      onClick: (event: { preventDefault: () => void }) => void;
      type: string;
    }>;
    expect(ready.props.type).toBe("button");
    ready.props.onClick({ preventDefault: vi.fn() });
    expect(onPress).toHaveBeenCalledOnce();

    for (const props of [
      { disabled: true, label: "Continue", onPress },
      { label: "Continue", loading: true, loadingLabel: "Working", onPress },
    ] as const) {
      const preventDefault = vi.fn();
      const element = Button(props) as ReactElement<{
        disabled: boolean;
        onClick: (event: { preventDefault: () => void }) => void;
      }>;
      element.props.onClick({ preventDefault });
      expect(element.props.disabled).toBe(true);
      expect(preventDefault).toHaveBeenCalledOnce();
    }
    expect(onPress).toHaveBeenCalledOnce();

    const loadingHtml = renderToStaticMarkup(
      <Button label="Continue" loading loadingLabel="Working" />,
    );
    expect(loadingHtml).toContain('aria-busy="true"');
    expect(loadingHtml).toContain('aria-label="Working"');
    expect(loadingHtml).toContain("Working");
    expect(loadingHtml).toContain(" disabled=");

    const serverSafe = Button({ label: "Continue" }) as ReactElement<{
      onClick?: unknown;
    }>;
    expect(serverSafe.props.onClick).toBeUndefined();
  });

  it("ignores malicious host props even when TypeScript is bypassed", () => {
    const malicious = {
      as: "iframe",
      attributionsrc: "https://tracker.invalid",
      dangerouslySetInnerHTML: { __html: "private-html-canary" },
      formAction: "https://tracker.invalid/collect",
      label: "Continue",
      ping: "https://tracker.invalid",
      role: "link",
      srcDoc: "private-srcdoc-canary",
      style: { background: "url(https://tracker.invalid)" },
      tabIndex: 99,
      target: "_blank",
    } as unknown as ButtonProps;
    const html = renderToStaticMarkup(<Button {...malicious} />);

    expect(html).toContain('<button aria-label="Continue"');
    for (const canary of [
      "iframe",
      "attributionsrc",
      "private-html-canary",
      "formaction",
      "tracker.invalid",
      "ping=",
      'role="link"',
      "private-srcdoc-canary",
      "style=",
      "tabindex",
      "target=",
    ]) {
      expect(html).not.toContain(canary);
    }
    expect(() =>
      renderToStaticMarkup(
        <Button {...({ label: "Continue", tone: "private-class" } as unknown as ButtonProps)} />,
      ),
    ).toThrow(TypeError);
  });

  it("requires a non-empty icon-button name and keeps its glyph decorative", () => {
    const html = renderToStaticMarkup(<IconButton icon="menu" label="Open navigation" />);
    expect(html).toContain('aria-label="Open navigation"');
    expect(html).toContain('type="button"');
    expect(html).toContain('<span aria-hidden="true" class="rvt-icon rvt-icon--menu">');
    expect(() => renderToStaticMarkup(<IconButton icon="menu" label=" " />)).toThrow(TypeError);

    const loading = renderToStaticMarkup(
      <IconButton icon="menu" label="Open navigation" loading loadingLabel="Opening navigation" />,
    );
    expect(loading).toContain('aria-label="Opening navigation"');
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain(" disabled=");
  });

  it("renders decorative, meaningful, and allowlisted directional icons", () => {
    expect(renderToStaticMarkup(<Icon name="info" />)).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<Icon label="Information" name="info" />)).toContain(
      'aria-label="Information"',
    );
    expect(renderToStaticMarkup(<DirectionalIcon direction="forward" />)).toContain(
      "rvt-icon--forward",
    );
  });

  it("associates text, textarea, and native-select labels, descriptions, and errors", () => {
    const required = { required: true as const, requiredLabel: "Required" };
    const text = renderToStaticMarkup(
      <TextField
        description="Use a short theme."
        error="Choose a supported theme."
        id={fieldId}
        label="Reflection theme"
        name={fieldName}
        placeholder="For example, change"
        {...required}
      />,
    );
    expect(text).toContain('<label class="rvt-field__label" for="reflection-question">');
    expect(text).toContain(
      'aria-describedby="reflection-question-description reflection-question-error"',
    );
    expect(text).toContain('aria-errormessage="reflection-question-error"');
    expect(text).toContain('aria-invalid="true"');
    expect(text).toContain('autoComplete="off"');
    expect(text).toContain('dir="auto"');
    expect(text).toContain("Required");

    const textarea = renderToStaticMarkup(
      <TextAreaField dir="rtl" id={fieldId} label="Reflection" name={fieldName} readOnly />,
    );
    expect(textarea).toContain("<textarea");
    expect(textarea).toContain('autoComplete="off"');
    expect(textarea).toContain('dir="rtl"');
    expect(textarea).toContain(' readOnly=""');

    const select = renderToStaticMarkup(
      <SelectField
        defaultValue={firstValue}
        id={fieldId}
        label="Theme"
        name={fieldName}
        options={[
          { label: "First theme", value: firstValue },
          { disabled: true, label: "Unavailable theme", value: secondValue },
        ]}
      />,
    );
    expect(select).toContain("<select");
    expect(select).toContain('<option value="first-option" selected="">First theme</option>');
    expect(select).toContain('disabled="" value="second-option"');
    expect(() =>
      renderToStaticMarkup(
        <SelectField
          id={fieldId}
          label="Theme"
          name={fieldName}
          options={[
            { label: "First", value: firstValue },
            { label: "Duplicate", value: firstValue },
          ]}
        />,
      ),
    ).toThrow(TypeError);
  });

  it("rejects ambiguous or unwritable controlled field and choice state at runtime", () => {
    const ambiguousText = {
      defaultValue: "initial",
      id: fieldId,
      label: "Reflection",
      value: "controlled",
    } as unknown as TextFieldProps;
    expect(() => renderToStaticMarkup(<TextField {...ambiguousText} />)).toThrow(TypeError);

    const unwritableText = {
      id: fieldId,
      label: "Reflection",
      value: "controlled",
    } as unknown as TextFieldProps;
    expect(() => renderToStaticMarkup(<TextField {...unwritableText} />)).toThrow(TypeError);
    expect(
      renderToStaticMarkup(
        <TextField id={fieldId} label="Reflection" readOnly value="controlled" />,
      ),
    ).toContain('readOnly=""');

    const unwritableCheckbox = {
      checked: true,
      id: fieldId,
      label: "Remember",
    } as unknown as CheckboxProps;
    expect(() => renderToStaticMarkup(<Checkbox {...unwritableCheckbox} />)).toThrow(TypeError);
  });

  it("rejects unreviewed text-control enums and unreasonable numeric attributes at runtime", () => {
    const invalidTextProps = [
      { autoComplete: "private-value" },
      { dir: "sideways" },
      { inputMode: "private-value" },
      { inputMode: "none" },
      { maxLength: 0 },
      { maxLength: 65_536 },
      { maxLength: 1.5 },
      { maxLength: Number.NaN },
      { type: "file" },
      { type: "password" },
      { autoComplete: "current-password", type: "text" },
    ];
    for (const invalidProps of invalidTextProps) {
      expect(() =>
        TextField({
          id: fieldId,
          label: "Reflection",
          ...invalidProps,
        } as unknown as TextFieldProps),
      ).toThrow(TypeError);
    }

    const invalidTextareaProps = [
      { autoComplete: "email" },
      { dir: "sideways" },
      { maxLength: 0 },
      { maxLength: 65_536 },
      { maxLength: 1.5 },
      { rows: 0 },
      { rows: 25 },
      { rows: 1.5 },
      { rows: Number.POSITIVE_INFINITY },
    ];
    for (const invalidProps of invalidTextareaProps) {
      expect(() =>
        TextAreaField({
          id: fieldId,
          label: "Reflection",
          ...invalidProps,
        } as never),
      ).toThrow(TypeError);
    }
  });

  it("revalidates branded control identifiers before they reach the DOM", () => {
    const forgedId = "Private ID" as typeof fieldId;
    const forgedName = "private value[]" as typeof fieldName;
    const forgedValue = "private value" as typeof firstValue;

    expect(() => renderToStaticMarkup(<TextField id={forgedId} label="Reflection" />)).toThrow(
      TypeError,
    );
    expect(() =>
      renderToStaticMarkup(<TextField id={fieldId} label="Reflection" name={forgedName} />),
    ).toThrow(TypeError);
    expect(() =>
      renderToStaticMarkup(<Button label="Continue" name={fieldName} value={forgedValue} />),
    ).toThrow(TypeError);
    expect(() =>
      renderToStaticMarkup(
        <SelectField
          defaultValue={forgedValue}
          id={fieldId}
          label="Theme"
          options={[{ label: "First", value: firstValue }]}
        />,
      ),
    ).toThrow(TypeError);

    const maximumLengthId = createUiControlId(`a${"b".repeat(63)}`);
    expect(() =>
      renderToStaticMarkup(
        <TextField description="Help" id={maximumLengthId} label="Reflection" />,
      ),
    ).toThrow(TypeError);
  });

  it("uses native checkbox, mixed, switch, and radio-group semantics", () => {
    const checkbox = renderToStaticMarkup(
      <Checkbox
        id={fieldId}
        label="Remember this choice"
        mixed
        name={fieldName}
        onCheckedChange={vi.fn()}
      />,
    );
    expect(checkbox).toContain('data-state="mixed"');
    expect(checkbox).toContain('aria-checked="mixed"');
    expect(checkbox).toContain('type="checkbox"');
    expect(() =>
      renderToStaticMarkup(
        <Checkbox
          {...({ id: fieldId, label: "Remember", mixed: true } as unknown as CheckboxProps)}
        />,
      ),
    ).toThrow(TypeError);
    expect(
      renderToStaticMarkup(
        <Checkbox disabled id={fieldId} label="Some choices" mixed name={fieldName} />,
      ),
    ).toContain(" disabled=");

    const switchHtml = renderToStaticMarkup(
      <Switch defaultChecked id={fieldId} label="Use calm motion" name={fieldName} />,
    );
    expect(switchHtml).toContain('role="switch"');
    expect(switchHtml).toContain('type="checkbox"');
    expect(switchHtml).toContain(" checked=");

    const radio = renderToStaticMarkup(
      <RadioGroup
        defaultValue={secondValue}
        id={fieldId}
        label="Choose one theme"
        name={fieldName}
        options={[
          { label: "First theme", value: firstValue },
          { label: "Second theme", value: secondValue },
        ]}
      />,
    );
    expect(radio).toContain("<fieldset");
    expect(radio).toContain("<legend");
    expect(radio.match(/type="radio"/gu)).toHaveLength(2);
    expect(radio).toMatch(/checked="" value="second-option"/u);
    const controlledEmptyRadio = renderToStaticMarkup(
      <RadioGroup
        id={fieldId}
        label="Choose one theme"
        name={fieldName}
        onValueChange={vi.fn()}
        options={[
          { label: "First theme", value: firstValue },
          { label: "Second theme", value: secondValue },
        ]}
        value={undefined}
      />,
    );
    expect(controlledEmptyRadio).not.toContain("checked=");
    expect(() =>
      renderToStaticMarkup(
        <RadioGroup id={fieldId} label="Choose one theme" name={fieldName} options={[]} />,
      ),
    ).toThrow(TypeError);
    expect(() =>
      renderToStaticMarkup(
        <RadioGroup
          id={fieldId}
          label="Choose one theme"
          name={fieldName}
          options={[
            { label: "First", value: firstValue },
            { label: "Duplicate", value: firstValue },
          ]}
        />,
      ),
    ).toThrow(TypeError);
  });

  it("keeps static alerts quiet and uses live roles only when explicitly requested", () => {
    const quiet = renderToStaticMarkup(
      <InlineAlert message="Your draft remains on this device." title="Private by default" />,
    );
    expect(quiet).not.toContain("role=");
    expect(quiet).not.toContain("aria-live");

    const polite = renderToStaticMarkup(
      <InlineAlert
        live="polite"
        message="Your changes are available."
        title="Saved"
        tone="success"
      />,
    );
    expect(polite).toContain('aria-live="polite"');
    expect(polite).toContain('role="status"');

    const urgent = renderToStaticMarkup(
      <InlineAlert
        live="assertive"
        message="Review the highlighted field."
        title="Unable to continue"
        tone="error"
      />,
    );
    expect(urgent).toContain('role="alert"');
  });

  it("keeps loading visuals decorative unless a caller supplies a status label", () => {
    expect(renderToStaticMarkup(<Spinner />)).toBe(
      '<span aria-hidden="true" class="rvt-spinner"></span>',
    );
    expect(renderToStaticMarkup(<Spinner label="Loading reflection" />)).toContain(
      'aria-label="Loading reflection"',
    );
    const skeleton = renderToStaticMarkup(<Skeleton lines={3} />);
    expect(skeleton).toContain('aria-hidden="true"');
    expect(skeleton.match(/rvt-skeleton__line/gu)).toHaveLength(3);
    expect(() => renderToStaticMarkup(<Skeleton lines={99 as 1} />)).toThrow(TypeError);
  });
});
