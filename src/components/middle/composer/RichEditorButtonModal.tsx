import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { memo, useMemo, useState } from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import { getRichTextPlainText } from '../../../global/helpers/richMessage';
import { selectUser } from '../../../global/selectors';
import { ensureProtocol } from '../../../util/browser/url';
import buildClassName from '../../../util/buildClassName';
import { buildButtonAction, buildButtonAttrs, getButtonColor } from '../../../util/tiptap/richButton';
import styles from '../../../util/tiptap/styling.module.scss';
import renderText from '../../common/helpers/renderText';
import { buildRichTextFromTiptapContent } from '../../ui/textInput/richText';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import PeerChip from '../../common/PeerChip';
import RecipientPicker from '../../common/RecipientPicker';
import Island from '../../gili/layout/Island';
import { RICH_BUTTON_ICONS } from '../../iv/RichButton';
import Button from '../../ui/Button';
import InputText from '../../ui/InputText';
import TabList from '../../ui/TabList';
import Modal, { ModalFooterActions, ModalHeader, ModalHeaderAction, ModalTitle } from '@gili/modal/Modal';

type OwnProps = {
  node: ProseMirrorNode;
  onSave: (node: ProseMirrorNode) => void;
  onDelete: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
};

const BUTTON_TYPES = [
  { value: 'url', label: 'RichButtonUrl' },
  { value: 'userProfile', label: 'RichButtonProfile' },
  { value: 'copy', label: 'RichButtonCopy' },
  { value: 'disabled', label: 'RichButtonDisabled' },
] as const;
const BUTTON_STYLES = [
  { value: '', label: 'RichButtonDefault' },
  { value: 'primary', label: 'RichButtonPrimary' },
  { value: 'destructive', label: 'RichButtonDanger' },
  { value: 'success', label: 'RichButtonSuccess' },
] as const;
const USER_FILTER = ['users'] as const;

const RichEditorButtonModal = ({ node, onSave, onDelete, onClose }: OwnProps) => {
  const lang = useLang();
  const [draft, setDraft] = useState<Partial<ReturnType<typeof buildButtonAttrs>>>(node.attrs);
  const [editedText, setEditedText] = useState<string>();
  const initialText = useMemo(() => getRichTextPlainText(buildRichTextFromTiptapContent(node.content.toJSON())),
    [node.content]);
  const text = editedText ?? initialText;
  const [hasInvalidUser, markInvalidUser, clearInvalidUser] = useFlag();
  const [hasInvalidUrl, markInvalidUrl, clearInvalidUrl] = useFlag();
  const [isUserPickerOpen, openUserPicker, closeUserPicker] = useFlag();
  const { buttonType, url, copyText, userId, color } = draft;
  const action = buildButtonAction(draft);
  const canSubmit = Boolean(text && action);
  const typeTabs = useMemo(() => BUTTON_TYPES.map(({ label }) => ({ title: lang(label) })), [lang]);
  const icon = RICH_BUTTON_ICONS[buttonType || 'url'];

  const updateAttributes = useLastCallback((attrs: Partial<ReturnType<typeof buildButtonAttrs>>) => {
    setDraft((current) => ({ ...current, ...attrs }));
    clearInvalidUser();
    if (attrs.url !== undefined || attrs.buttonType !== undefined) clearInvalidUrl();
  });
  const handleTypeChange = useLastCallback((index: number) => {
    updateAttributes({ buttonType: BUTTON_TYPES[index].value });
  });
  const handleSelectUser = useLastCallback((selectedUserId: string) => {
    updateAttributes({ userId: selectedUserId });
    closeUserPicker();
  });

  const handleSubmit = useLastCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit || !action) return;
    const buttonUrl = action.type === 'url' ? buildButtonUrl(action.url) : undefined;
    if (action.type === 'url' && !buttonUrl) {
      markInvalidUrl();
      return;
    }
    if (action.type === 'userProfile' && !selectUser(getGlobal(), action.userId)?.accessHash) {
      markInvalidUser();
      return;
    }
    const content = editedText === undefined ? node.content : node.type.schema.text(text);
    const attrs = buildButtonAttrs(action, { type: getButtonColor(color) });
    if (action.type === 'url') attrs.url = buttonUrl;
    onSave(node.type.create(attrs, content));
  });

  const valueLabel = buttonType === 'url' ? 'FormattingLinkUrl' : 'RichEditorButtonCopyText';
  const header = useMemo(() => (
    <ModalHeader>
      <ModalTitle>{lang('RichButtonEdit')}</ModalTitle>
      <ModalHeaderAction>
        <Button round isText color="danger" iconName="delete" ariaLabel={lang('Delete')} onClick={onDelete} />
      </ModalHeaderAction>
    </ModalHeader>
  ), [lang, onDelete]);

  return (
    <Modal isOpen header={header} width="slim" height="auto" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Island>
          <div className={styles.buttonPreview}>
            <div
              className={buildClassName(styles.richButton, styles.buttonPreviewContent,
                icon && styles.richButtonWithIcon)}
              data-color={color}
              data-disabled={buttonType === 'disabled' || undefined}
            >
              <span className={styles.richButtonLabel}>
                {renderText(text)}
              </span>
              {icon && (
                <Icon
                  name={icon}
                  className={buildClassName(styles.richButtonIcon,
                    icon === 'arrow-right' && styles.richButtonExternalIcon)}
                />
              )}
            </div>
          </div>
          {/* TODO: Use a shared Rich Text input for custom emoji and formatted dates */}
          <InputText
            label={lang('Text')}
            value={text}
            onChange={(e) => setEditedText(e.target.value)}
            autoFocus
          />
          <TabList
            className={styles.buttonTypeTabs}
            tabClassName={styles.buttonTypeTab}
            stretched
            tabs={typeTabs}
            activeTab={BUTTON_TYPES.findIndex(({ value: type }) => type === buttonType)}
            onSwitchTab={handleTypeChange}
          />
          {buttonType === 'userProfile' && (
            <div className={styles.buttonUserField}>
              <Button isText noForcedUpperCase onClick={openUserPicker}>
                {userId ? <PeerChip peerId={userId} forceShowSelf /> : lang('RichButtonSelectUser')}
              </Button>
              {hasInvalidUser && <div className={styles.buttonUserError}>{lang('RichButtonUnknownUser')}</div>}
            </div>
          )}
          {(buttonType === 'url' || buttonType === 'copy') && (
            <InputText
              label={lang(valueLabel)}
              value={(buttonType === 'url' ? url : copyText) || ''}
              error={hasInvalidUrl ? lang('RichButtonInvalidUrl') : undefined}
              onChange={(e) => updateAttributes(buttonType === 'url'
                ? { url: e.target.value } : { copyText: e.target.value })}
            />
          )}
          <div className={styles.buttonStyleLabel}>{lang('RichButtonStyle')}</div>
          <div className={styles.buttonStyleOptions} role="group" aria-label={lang('RichButtonStyle')}>
            {BUTTON_STYLES.map(({ value: style, label }) => (
              <button
                key={style}
                type="button"
                className={buildClassName(styles.richButton, styles.buttonStyleOption,
                  (color || '') === style && styles.buttonStyleSelected)}
                data-color={style}
                aria-pressed={(color || '') === style}
                onClick={() => updateAttributes({ color: getButtonColor(style) })}
              >
                {lang(label)}
              </button>
            ))}
          </div>
        </Island>
        <ModalFooterActions>
          <Button className={styles.buttonDialogAction} size="smaller" isText onClick={onClose}>
            {lang('Cancel')}
          </Button>
          <Button className={styles.buttonDialogAction} size="smaller" type="submit" disabled={!canSubmit}>
            {lang('Save')}
          </Button>
        </ModalFooterActions>
      </form>
      {isUserPickerOpen && (
        <RecipientPicker
          isOpen
          isNativeDialog
          title={lang('RichButtonSelectUser')}
          searchPlaceholder={lang('Search')}
          filter={USER_FILTER}
          onSelectRecipient={handleSelectUser}
          onClose={closeUserPicker}
        />
      )}
    </Modal>
  );
};

export default memo(RichEditorButtonModal);

function buildButtonUrl(value: string): string | undefined {
  try {
    const url = new URL(ensureProtocol(value.trim()));
    const { protocol, hostname, username, password, port } = url;
    if (protocol === 'http:' || protocol === 'https:') {
      return hostname.includes('.') || hostname.startsWith('[') ? url.href : undefined;
    }
    if (protocol === 'tg:' || protocol === 'ton:') {
      return /^[a-z\d_-]+$/i.test(hostname) && !username && !password && !port ? url.href : undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
