/* eslint-disable no-console */
import { useState } from 'react';
import { useCallback, useEffect } from '../lib/teact/teact';

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
    localStorage.setItem('keywordRules', JSON.stringify(rules));
  }, [rules]);

  // Функция для добавления нового правила
  const addRule = useCallback((newKeyword: string, newFolderId: number) => {
    const newRule = { keyword: newKeyword, folderId: newFolderId };
    console.log('Добавление нового правила:', newRule); // Логирование добавленного правила
    setRules((prevRules) => {
      const updatedRules = [...prevRules, newRule];
      console.log('Обновленный список правил:', updatedRules); // Логирование обновленного списка правил
      return updatedRules;
    });
  }, []);

  // Функция для обработки правил
  const processRules = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log('Обработка правил...');
    // Здесь логика для обработки правил, например, добавление чатов в папки
  }, []);

  useEffect(() => {
    const interval = setInterval(processRules, 60000); // Устанавливаем интервал в 1 минуту

    return () => clearInterval(interval); // Очищаем интервал при размонтировании
  }, [processRules]);

  return {
    keyword,
    setKeyword,
    rules,
    addRule,
  };
};

export default useKeywordFolderRule;
