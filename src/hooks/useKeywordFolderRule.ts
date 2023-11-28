import { useState } from 'react';
import { useCallback, useEffect } from '../lib/teact/teact';
import { getActions, getGlobal } from '../global';

import { DEFAULT_LIMITS } from '../config';
import { selectIsCurrentUserPremium } from '../global/selectors';

export type Rule = {
  keyword: string;
  folderId: number;
};

const ONE_MINUTE = 60000;

const useKeywordFolderRule = () => {
  const [rules, setRules] = useState<Rule[]>(() => {
    // Получаем правила из localStorage при инициализации
    const savedRules = localStorage.getItem('keywordRules');
    return savedRules ? JSON.parse(savedRules) as Rule[] : [];
  });
  const [keyword, setKeyword] = useState('');
  const [isRulesUpdated, setIsRulesUpdated] = useState(false);

  // Сохраняем правила в localStorage каждый раз, когда они обновляются
  useEffect(() => {
    // Сохраняем в localStorage только если есть валидные правила
    if (rules.every((rule) => rule.keyword && rule.folderId)) {
      localStorage.setItem('keywordRules', JSON.stringify(rules));
    }
  }, [rules]);

  // Функция для добавления нового правила
  const addRule = useCallback((newKeyword: string, newFolderId: number) => {
    // Проверка, что ключевое слово задано и не пустое, а также что ID папки задан
    if (typeof newKeyword !== 'string' || !newKeyword.trim() || !newFolderId) {
      return;
    }
    const newRule = { keyword: newKeyword, folderId: newFolderId };
    setRules((prevRules) => [...prevRules, newRule]);
    setIsRulesUpdated(true);
  }, []);

  const { editChatFolders } = getActions();
  const global = getGlobal();
  const chatsById = global.chats.byId;
  const chatFoldersById = global.chatFolders.byId;
  const isPremium = selectIsCurrentUserPremium(global);
  const chatsInFolderLimit = DEFAULT_LIMITS.dialogFiltersChats[isPremium ? 1 : 0];

  // Функция для обработки правил
  const processRules = useCallback(() => {
    rules.forEach((rule) => {
      const ruleKeywordLowercase = rule.keyword.toLowerCase();
      const currentFolder = chatFoldersById[rule.folderId];
      if (!currentFolder) { return; } // insanity check

      const totalChatsInFolder = (
        currentFolder.includedChatIds.length
        + (currentFolder.pinnedChatIds?.length || 0)
      );
      if (totalChatsInFolder >= chatsInFolderLimit) {
        // eslint-disable-next-line no-console
        console.log(`Достигнут лимит на количество чатов в папке ${rule.folderId}`);
        return;
      }

      const chatIdsInCurrentFolder = new Set(currentFolder.includedChatIds || []);
      Object.values(chatsById).forEach((chat) => {
        const chatTitleLowercase = chat.title.toLowerCase();
        if (chatTitleLowercase.includes(ruleKeywordLowercase) && !chatIdsInCurrentFolder.has(chat.id)) {
          editChatFolders({
            chatId: chat.id,
            idsToAdd: [rule.folderId],
            idsToRemove: [],
          });
          // eslint-disable-next-line no-console
          console.log(`Чат с ID ${chat.id} добавлен в папку с ID ${rule.folderId}`);
        }
      });
    });

    // Сброс флага обновления правил
    if (isRulesUpdated) {
      setIsRulesUpdated(false);
    }
  }, [rules, isRulesUpdated, chatFoldersById, chatsInFolderLimit, chatsById]);

  useEffect(() => {
    const interval = setInterval(processRules, ONE_MINUTE); // Устанавливаем интервал в 1 минуту

    return () => clearInterval(interval); // Очищаем интервал при размонтировании
  }, [processRules]);

  return {
    keyword,
    setRules,
    setKeyword,
    rules,
    addRule,
  };
};

export default useKeywordFolderRule;
