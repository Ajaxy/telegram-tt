import type { ChangeEvent } from 'react';
import type { FC } from '../../lib/teact/teact';
import React, { useRef, useState } from '../../lib/teact/teact';

const TestOrdered: FC<{}> = () => {
  const [items, setItems] = useState<Record<string, number>>({ a: 1, b: 5, c: 10 });
  const [value, setValue] = useState<number | undefined>();
  const [isDesc, setIsDesc] = useState(false);

  const insertData = (newValue: number) => {
    const key = `key${Math.random()}`;
    setItems((currentItems) => (
      { ...currentItems, [key]: newValue }
    ));
    setValue(undefined);
  };

  const updateData = (key: string, newValue: number) => {
    setItems({ ...items, [key]: newValue });
  };

  const deleteData = (key: string) => {
    const newItems = { ...items };
    delete newItems[key];
    setItems(newItems);
  };

  const addSmalls = () => {
    [-5, -10, -20].forEach(insertData);
  };

  const addBigs = () => {
    [105, 110, 120].forEach(insertData);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValue(Number(e.target.value));
  };

  const handleDescChange = (e: ChangeEvent<HTMLInputElement>) => {
    setIsDesc(e.target.checked);
  };

  const sortedItems = Object
    .entries(items)
    .sort(([, value1], [, value2]) => (isDesc ? value2 - value1 : value1 - value2));

  return (
    <div id="mainContainer">
      <div>
        <p>
          <label>
            <input
              type="checkbox"
              checked={isDesc}
              onChange={handleDescChange}
            /> — DESC
          </label>
        </p>
        <p>
          <input type="text" value={value} onChange={handleInputChange} />
          <input type="submit" className="button" onClick={() => insertData(value || 0)} value="Insert Ordered" />
        </p>
        <p>
          <input type="submit" className="button" onClick={addSmalls} value="Add Smalls" />
          <input type="submit" className="button" onClick={addBigs} value="Add Bigs" />
        </p>
      </div>
      <ul teactFastList>
        {sortedItems.map(([key, itemValue]) => (
          <MyComponent
            teactOrderKey={itemValue}
            key={key}
            value={itemValue}
            // eslint-disable-next-line react/jsx-no-bind
            onChange={(newValue) => updateData(key, Number(newValue))}
            // eslint-disable-next-line react/jsx-no-bind
            onDelete={() => deleteData(key)}
          />
        ))}
      </ul>
    </div>
  );
};

function MyComponent({
  value,
  onChange,
  onDelete,
}: {
  value: number;
  onChange: (newValue: string) => void;
  onDelete: NoneToVoidFunction;
}) {
  const id = useRef(String(Math.random()).slice(-3));

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <li>
      <input type="text" value={value} size={3} onChange={handleChange} />
      <input type="button" value="x" onClick={onDelete} />
      {id.current}
    </li>
  );
}

export default TestOrdered;
