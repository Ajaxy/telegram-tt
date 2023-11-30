import type { RefObject } from 'react';
import { useEffect, useState } from '../../../../lib/teact/teact';

import type { IconName } from '../../../../types/icons';
import type { Signal } from '../../../../util/signals';

import {
  CONTENT_TYPES_WITH_PREVIEW, SUPPORTED_AUDIO_CONTENT_TYPES,
  SUPPORTED_IMAGE_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
} from '../../../../config';
import { validateFiles } from '../../../../util/files';
import { getHtmlBeforeSelection, setCaretPosition } from '../../../../util/selection';
import { openSystemFilesDialog } from '../../../../util/systemFilesDialog';
import { prepareForRegExp } from '../helpers/prepareForRegExp';

import { useThrottledResolver } from '../../../../hooks/useAsyncResolvers';
import useDerivedSignal from '../../../../hooks/useDerivedSignal';
import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';

const THROTTLE = 300;
let RE_ATTACH_SEARCH: RegExp;
try {
  RE_ATTACH_SEARCH = /(^|\s)\/[-_\p{L}\p{M}\p{N}]*$/gui; // Используйте Unicode Property Escapes для поддержки международных символов
} catch (e) {
  RE_ATTACH_SEARCH = /(^|\s)\/[-_\d\wа-яёґєії]*$/gi; // Безопасный вариант для браузеров без поддержки Unicode Property Escapes
}

interface Option {
  title: string;
  icon?: IconName;
  shortcut?: string;
  callback: () => void;
}

const useAttachTooltip = (
  isEnabled: boolean,
  inputRef: RefObject<HTMLDivElement>,
  getHtml: Signal<string>,
  getSelectionRange: Signal<Range | undefined>,
  canAttachMedia: boolean,
  canAttachPolls: boolean,
  canSendPhotos: boolean,
  canSendVideos: boolean,
  canSendAudios: boolean,
  canSendDocuments: boolean,
  onFileSelect: (files: File[], shouldSuggestCompression?: boolean) => void,
  onPollCreate: () => void,
  removeSlashSymbol: () => void,
  removeSlashSymbolAttachmentModal: () => void,
): {
    filteredOptions: Option[];
    isTooltipOpen: boolean;
    closeTooltip: () => void;
  } => {
  const [options, setOptions] = useState<Option[]>([]);
  const [filteredOptions, setFilteredOptions] = useState<Option[]>([]);
  const [isManuallyClosed, markManuallyClosed, unmarkManuallyClosed] = useFlag(false);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const extractSlashTagThrottled = useThrottledResolver(() => {
    const html = getHtml();
    if (!isEnabled || !getSelectionRange()?.collapsed || !html.includes('/')) return undefined;

    const htmlBeforeSelection = getHtmlBeforeSelection(inputRef.current!);

    return prepareForRegExp(htmlBeforeSelection).match(RE_ATTACH_SEARCH)?.[0].trim();
  }, [isEnabled, getHtml, getSelectionRange, inputRef], THROTTLE);

  const getSlashTag = useDerivedSignal(
    extractSlashTagThrottled, [extractSlashTagThrottled, getHtml, getSelectionRange], true,
  );

  const updateInputHtml = (newHtml: string) => {
    const inputEl = inputRef.current;
    if (inputEl) {
      // Обновляем HTML содержимое
      inputEl.innerHTML = newHtml;
      // Устанавливаем курсор в нужное место
      setCaretPosition(inputEl, newHtml.length);
    }
  };

  const handleFileSelect = useLastCallback((e: Event, shouldSuggestCompression?: boolean) => {
    // Получаем файлы из события
    const fileList = (e.target as HTMLInputElement).files;

    // Проверяем, есть ли файлы
    if (!fileList) return;

    // Преобразуем FileList в массив
    const filesArray = Array.from(fileList);

    // Валидация и обработка файлов
    const validatedFiles = validateFiles(filesArray);
    if (validatedFiles?.length) {
      onFileSelect(validatedFiles, shouldSuggestCompression);
    }
    const currentHtml = getHtml();
    const newHtml = currentHtml.replace('/', '');
    updateInputHtml(newHtml);
  });

  const canSendVideoAndPhoto = canSendPhotos && canSendVideos;
  const handleQuickSelect = useLastCallback(() => {
    const acceptedTypes = canSendVideoAndPhoto ? CONTENT_TYPES_WITH_PREVIEW
      : (canSendPhotos ? SUPPORTED_IMAGE_CONTENT_TYPES : SUPPORTED_VIDEO_CONTENT_TYPES);
    openSystemFilesDialog(
      Array.from(acceptedTypes).join(','),
      (e) => handleFileSelect(e, true), // Обратите внимание на второй параметр
    );
    removeSlashSymbol();
    removeSlashSymbolAttachmentModal();
  });

  const handleDocumentSelect = useLastCallback(() => {
    const acceptedTypes = !canSendDocuments && canSendAudios ? SUPPORTED_AUDIO_CONTENT_TYPES : '*';
    openSystemFilesDialog(
      Array.from(acceptedTypes).join(','),
      (e) => handleFileSelect(e, false), // Обратите внимание на второй параметр
    );
  });

  useEffect(() => {
    const newOptions = [] as Option[];
    if (canAttachMedia) {
      if (canSendPhotos || canSendVideos) {
        newOptions.push({
          title: 'Photo', icon: 'photo', shortcut: '⌘ ⇧ U', callback: handleQuickSelect,
        });
      }
      if (canSendDocuments) {
        newOptions.push({ title: 'Document', icon: 'document', callback: handleDocumentSelect });
      }
    }
    if (canAttachPolls) {
      newOptions.push({ title: 'Poll', icon: 'poll', callback: onPollCreate });
    }
    setOptions(newOptions);
  }, [
    canAttachMedia,
    canAttachPolls,
    onFileSelect,
    onPollCreate,
    handleQuickSelect,
    handleDocumentSelect,
    canSendPhotos,
    canSendVideos,
    canSendDocuments,
  ]);

  useEffect(() => {
    const inputEl = inputRef.current;

    const handleInputChange = () => {
      const inputText = inputEl?.textContent || '';
      const slashIndex = inputText.lastIndexOf('/');
      const hasSlash = slashIndex !== -1;

      if (hasSlash) {
        // Выделяем текст после слеша
        const textAfterSlash = inputText.substring(slashIndex + 1).toLowerCase();
        setFilteredOptions(options.filter((option) => option.title.toLowerCase().startsWith(textAfterSlash)));
        setIsTooltipVisible(true);
      } else {
        setIsTooltipVisible(false);
      }
    };

    inputEl?.addEventListener('input', handleInputChange);

    return () => {
      inputEl?.removeEventListener('input', handleInputChange);
    };
  }, [inputRef, options]);

  useEffect(() => {
    const slashTag = getSlashTag();
    if (slashTag) {
      unmarkManuallyClosed();
    } else {
      markManuallyClosed();
    }
  }, [getSlashTag, markManuallyClosed, unmarkManuallyClosed]);

  return {
    filteredOptions,
    isTooltipOpen: isTooltipVisible && isEnabled && !isManuallyClosed,
    closeTooltip: markManuallyClosed,
  };
};

export default useAttachTooltip;
