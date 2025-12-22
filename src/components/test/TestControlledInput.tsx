import { useState } from '../../lib/teact/teact';

const Test = () => {
  const [inputValue, setInputValue] = useState('Controlled');
  const [isCheckboxAllowed, setIsCheckboxAllowed] = useState(true);
  const [isChecked, setIsChecked] = useState(true);

  function removeVowels(e: React.FormEvent<HTMLInputElement>) {
    const nextValue = e.currentTarget.value.replace(/[aeiou]/g, '');
    // eslint-disable-next-line no-console
    console.log('!!!', { nextValue });
    setInputValue(nextValue);
  }

  function handleAllowCheckbox() {
    setIsCheckboxAllowed((current) => !current);
  }

  function handleCheck() {
    if (!isCheckboxAllowed) {
      return;
    }

    setIsChecked((current) => !current);
  }

  return (
    <>
      <div>
        <input defaultValue="Uncontrolled" />
      </div>

      <div>
        <div>
          Input value:
          {inputValue}
        </div>
        <input value={inputValue} onChange={removeVowels} teactExperimentControlled />
      </div>

      <div>—</div>

      <div>
        Checkbox value:
        {String(isChecked)}
      </div>
      <div>
        <label>
          <input type="checkbox" defaultChecked={isCheckboxAllowed} onChange={handleAllowCheckbox} />
          {' '}
          — Is allowed?
        </label>
      </div>
      <div>
        <label>
          <input type="checkbox" checked={isChecked} onChange={handleCheck} />
          {' '}
          — Is checked?
        </label>
      </div>
    </>
  );
};

export default Test;
