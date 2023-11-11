/* eslint-disable no-null/no-null */
import React, { useState } from 'react';
import chrono from 'chrono-node';

const DateParser: React.FC = () => {
  const [input, setInput] = useState('');
  const [date, setDate] = useState<Date | null>(null);

  const handleParseDate = () => {
    const parsedDate = chrono.parseDate(input);
    setDate(parsedDate);
  };

  return (
    <div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Введите дату или время"
      />
      <button onClick={handleParseDate}>Распознать</button>
      {date && <p>Распознанная дата: {date.toString()}</p>}
    </div>
  );
};

export default DateParser;
