import * as React from "react";
import type { ReactNode } from "react";

import {
  ActionLink,
  Button,
  Checkbox,
  DirectionalIcon,
  EmptyState,
  ErrorState,
  IconButton,
  InlineAlert,
  OfflineState,
  ProviderUnavailableState,
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
        <div aria-busy="true" aria-label="Loading content" role="status">
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

      <section aria-labelledby="states-title" className="preview-section">
        <h2 id="states-title">Page-level state patterns</h2>
        <p>
          These are synthetic verification states, not production incidents, provider status, or
          product availability claims.
        </p>
        <div className="preview-state-grid">
          <EmptyState
            message="No synthetic examples are in this bounded collection. Choose a local section to continue."
            primaryAction={{
              href: createLocalActionHref("#fields"),
              kind: "link",
              label: "Review synthetic fields",
            }}
            title="Nothing here yet"
            titleAs="h3"
            titleId={createUiControlId("preview-empty-title")}
          />
          <ErrorState
            message="A synthetic interruption prevents this example from continuing. No private or raw error details are shown."
            primaryAction={{
              href: createLocalActionHref("#actions-title"),
              kind: "link",
              label: "Return to actions",
            }}
            title="Unable to show this example"
            titleAs="h3"
            titleId={createUiControlId("preview-error-state-title")}
          />
          <OfflineState
            message="This synthetic example represents an apparent connection loss without promising caching, saving, or synchronization."
            title="The device appears offline"
            titleAs="h3"
            titleId={createUiControlId("preview-offline-title")}
          />
          <ProviderUnavailableState
            message="A generic supporting service did not respond in this synthetic example. No provider or internal detail is exposed."
            primaryAction={{
              href: createLocalActionHref("#preview-title"),
              kind: "link",
              label: "Return to preview start",
            }}
            title="This example is temporarily unavailable"
            titleAs="h3"
            titleId={createUiControlId("preview-provider-title")}
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
          <div data-writing-system="ja" lang="ja">
            <InlineAlert
              message="これは実在の利用者データを含まない表示確認用の文章です。改行と読みやすさを確認します。"
              title="日本語の表示確認"
            />
            <TextField
              autoComplete="name"
              description="合成した氏名入力で、IME の変換中テキストを保持する確認欄です。"
              id={createUiControlId("preview-japanese-name")}
              label="合成氏名"
              name={createUiControlName("preview.japanese-name")}
            />
            <TextField
              id={createUiControlId("preview-japanese-date")}
              label="確認日"
              minimum="1900-01-01"
              name={createUiControlName("preview.japanese-date")}
              type="date"
            />
            <p className="preview-line-break-probe" data-line-break-probe="ja">
              静かな光（合成）を見つめ、問いを急がずに書き留めます。
            </p>
          </div>
          <div data-writing-system="ko" lang="ko">
            <InlineAlert
              message="이 문장은 실제 사용자 데이터를 포함하지 않으며 줄바꿈과 글꼴 대체만 확인합니다."
              title="한국어 표시 확인"
            />
            <p className="preview-line-break-probe" data-line-break-probe="ko">
              고요한 빛(합성)을 바라보고, 질문을 서두르지 않고 적어 봅니다.
            </p>
          </div>
          <div data-writing-system="zh-Hans" lang="zh-Hans">
            <InlineAlert
              message="这段合成文本不包含真实用户数据，仅用于检查简体中文字体回退和自然换行。"
              title="简体中文显示检查"
            />
            <p className="preview-line-break-probe" data-line-break-probe="zh-Hans">
              注视安静的光（合成），不急着回答，并把问题写下来。
            </p>
          </div>
          <div data-writing-system="zh-Hant" lang="zh-Hant">
            <InlineAlert
              message="這段合成文字不包含真實使用者資料，只用於檢查繁體中文字型回退與自然換行。"
              title="繁體中文顯示檢查"
            />
            <p className="preview-line-break-probe" data-line-break-probe="zh-Hant">
              注視安靜的光（合成），不急著回答，並把問題寫下來。
            </p>
          </div>
          <div data-writing-system="hi" lang="hi">
            <InlineAlert
              message="यह केवल अक्षर विन्यास और पंक्ति प्रवाह की जाँच के लिए बनाया गया कृत्रिम पाठ है।"
              title="देवनागरी प्रदर्शन जाँच"
            />
            <TextField
              autoComplete="name"
              description="यह कृत्रिम नाम क्षेत्र संयोजन चिह्नों और IME इनपुट को ज्यों का त्यों रखता है।"
              id={createUiControlId("preview-hindi-name")}
              label="कृत्रिम नाम"
              name={createUiControlName("preview.hindi-name")}
            />
            <TextField
              id={createUiControlId("preview-hindi-date")}
              label="जाँच की तारीख"
              minimum="1900-01-01"
              name={createUiControlName("preview.hindi-date")}
              type="date"
            />
            <p className="preview-shaping-probe" data-shaping-probe="hi">
              क्षि क्‍ष नमस्ते
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
