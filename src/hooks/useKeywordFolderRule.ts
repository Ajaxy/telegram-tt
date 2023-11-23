/* eslint-disable no-console */
import { useState } from 'react';
import { useCallback, useEffect } from '../lib/teact/teact';
import { getActions, getGlobal } from '../global';

export type Rule = {
  keyword: string;
  folderId: number;
};

const useKeywordFolderRule = () => {
  const [rules, setRules] = useState<Rule[]>(() => {
    // Получаем правила из localStorage при инициализации
    const savedRules = localStorage.getItem('keywordRules');
    return savedRules ? JSON.parse(savedRules) as Rule[] : [];
  });
  const [keyword, setKeyword] = useState('');

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
      console.log('Invalid rule data');
      return;
    }
    const newRule = { keyword: newKeyword, folderId: newFolderId };
    setRules((prevRules) => [...prevRules, newRule]);
  }, []);

  const { editChatFolders } = getActions();

  // Функция для обработки правил
  const processRules = useCallback(() => {
    console.log('Обработка правил...');

    const global = getGlobal();
    const chatsById = global.chats.byId;
    const chatFoldersById = global.chatFolders.byId;

    rules.forEach((rule) => {
      const currentFolder = chatFoldersById[rule.folderId];
      const chatIdsInCurrentFolder = currentFolder ? currentFolder.includedChatIds : [];
      Object.values(chatsById).forEach((chat) => {
        if (chat.title.includes(rule.keyword)) {
          // Проверяем, не находится ли чат уже в папке
          const isAlreadyInFolder = chatIdsInCurrentFolder.includes(chat.id);

          if (!isAlreadyInFolder) {
            editChatFolders({
              chatId: chat.id,
              idsToAdd: [rule.folderId],
              idsToRemove: [],
            });
            console.log(`Чат с ID ${chat.id} и названием '${chat.title}' добавлен в папку с ID ${rule.folderId}`);
          }
        }
      });
    });
  }, [rules, editChatFolders]);

  useEffect(() => {
    const interval = setInterval(processRules, 60000); // Устанавливаем интервал в 1 минуту

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
