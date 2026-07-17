import * as React from "react";
import type { ReactNode } from "react";

import {
  ActionLink,
  Button,
  Checkbox,
  DirectionalIcon,
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
} from "../src/index.js";

const controlName = createUiControlName("preview.choice");
const firstValue = createUiControlValue("first-option");
const secondValue = createUiControlValue("second-option");

export function UiPreview(): ReactNode {
  return (
    <main id="main-content">
      <section aria-labelledby="preview-title" className="preview-section">
        <p className="preview-eyebrow">RITUVIA UI contract</p>
        <h1 id="preview-title">Accessible native-first primitives</h1>
        <p>
          This synthetic preview exercises state, theme, long-content, writing-system, and reflow
          behavior. It is not production copy or a public route.
        </p>
      </section>

      <section aria-labelledby="actions-title" className="preview-section">
        <h2 id="actions-title">Actions and status</h2>
        <div className="preview-row">
          <Button label="Continue" />
          <Button label="Continue" loading loadingLabel="Working" />
          <Button disabled label="Unavailable" />
          <ActionLink href={createLocalActionHref("#fields")} variant="secondary">
            Review fields
          </ActionLink>
          <IconButton icon="menu" label="Open navigation" />
          <Spinner label="Loading preview" />
        </div>
        <div className="preview-grid">
          <InlineAlert
            message="The visible words and icon communicate this state without relying on color."
            title="Information"
          />
          <InlineAlert
            message="Review the associated field and try again."
            title="Unable to continue"
            tone="error"
          />
        </div>
        <div aria-busy="true" aria-label="Loading content">
          <Skeleton lines={3} />
        </div>
      </section>

      <section aria-labelledby="fields-title" className="preview-section" id="fields">
        <h2 id="fields-title">Fields and selection</h2>
        <div className="preview-grid">
          <TextField
            description="Use a short synthetic value for this preview."
            id={createUiControlId("preview-theme")}
            label="Reflection theme"
            name={createUiControlName("preview.theme")}
            placeholder="For example, change"
            required
            requiredLabel="Required"
          />
          <TextField
            error="Choose a supported synthetic theme."
            id={createUiControlId("preview-error")}
            label="Theme with an error"
            name={createUiControlName("preview.error")}
          />
          <TextAreaField
            description="The textarea remains resizable in the block direction."
            id={createUiControlId("preview-reflection")}
            label="Synthetic reflection"
            name={createUiControlName("preview.reflection")}
          />
          <SelectField
            defaultValue={firstValue}
            id={createUiControlId("preview-select")}
            label="Choose one option"
            name={controlName}
            options={[
              { label: "First option", value: firstValue },
              { label: "Second option", value: secondValue },
            ]}
          />
        </div>
        <div className="preview-grid">
          <Checkbox
            id={createUiControlId("preview-checkbox")}
            label="Remember this synthetic choice"
            name={controlName}
          />
          <Checkbox
            disabled
            id={createUiControlId("preview-mixed")}
            label="Some nested choices are selected"
            mixed
            name={controlName}
          />
          <Switch
            id={createUiControlId("preview-switch")}
            label="Use calm motion"
            name={controlName}
          />
          <RadioGroup
            defaultValue={firstValue}
            id={createUiControlId("preview-radio")}
            label="Choose exactly one option"
            name={controlName}
            options={[
              { label: "First option", value: firstValue },
              { label: "Second option", value: secondValue },
            ]}
          />
        </div>
      </section>

      <section aria-labelledby="locale-title" className="preview-section">
        <h2 id="locale-title">Long content and writing systems</h2>
        <div className="preview-grid">
          <InlineAlert
            message="Diese absichtlich sehr lange synthetische Beschriftung prüft, ob erweiterter deutscher Text ohne Abschneiden oder horizontales Überlaufen lesbar bleibt."
            title="Langer deutscher Beispieltext"
          />
          <div dir="rtl" lang="ar">
            <TextField
              description="هذا نص تجريبي لا يحتوي على بيانات مستخدم حقيقية."
              id={createUiControlId("preview-arabic")}
              label="موضوع للتأمل"
              name={createUiControlName("preview.arabic")}
            />
            <div data-direction-fixture="ltr" dir="ltr" lang="en">
              <DirectionalIcon direction="forward" />
              <Switch
                defaultChecked
                id={createUiControlId("preview-ltr-switch")}
                label="Nested left-to-right direction check"
                name={createUiControlName("preview.ltr-switch")}
              />
            </div>
          </div>
          <InlineAlert
            message="これは実在の利用者データを含まない表示確認用の文章です。改行と読みやすさを確認します。"
            title="日本語の表示確認"
          />
          <InlineAlert
            message="यह केवल अक्षर विन्यास और पंक्ति प्रवाह की जाँच के लिए बनाया गया कृत्रिम पाठ है।"
            title="देवनागरी प्रदर्शन जाँच"
          />
        </div>
      </section>
    </main>
  );
}
