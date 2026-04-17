/* eslint-disable @stylistic/max-len */
import { useState } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import Control, {
  ControlAfter,
  ControlBefore,
  ControlDescription,
  ControlLabel,
} from '../../gili/layout/Control';
import Interactive from '../../gili/layout/Interactive';
import Island, {
  IslandDescription,
  IslandText,
} from '../../gili/layout/Island';
import Surface from '../../gili/layout/Surface';
import Checkbox from '../../gili/primitives/Checkbox';
import Radio from '../../gili/primitives/Radio';
import Switch from '../../gili/primitives/Switch';
import CheckboxField from '../../gili/templates/CheckboxField';
import SwitchField from '../../gili/templates/SwitchField';

import styles from './FieldDemo.module.scss';

type SectionProps = {
  title: string;
  children: React.ReactNode;
  noBorder?: boolean;
};

function Section({ title, children, noBorder }: SectionProps) {
  return (
    <div className={styles.section}>
      <Island>
        <h3 className={styles.sectionTitle}>{title}</h3>
        <div className={buildClassName(styles.sectionContent, noBorder && styles.sectionContentNoBorder)}>
          {children}
        </div>
      </Island>
    </div>
  );
}

const FieldDemo = () => {
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(true);
  const [check3, setCheck3] = useState(false);
  const [check4, setCheck4] = useState(true);
  const [check5, setCheck5] = useState(false);
  const [check6, setCheck6] = useState(false);
  const [check7, setCheck7] = useState(true);
  const [check8, setCheck8] = useState(false);
  const [check9, setCheck9] = useState(false);
  const [checkRound1, setCheckRound1] = useState(false);
  const [checkRound2, setCheckRound2] = useState(true);
  const [itemA, setItemA] = useState(true);
  const [itemB, setItemB] = useState(false);
  const [itemC, setItemC] = useState(true);
  const [templateCheckbox, setTemplateCheckbox] = useState(true);
  const [permissionSwitch, setPermissionSwitch] = useState(false);
  const [templateSwitch, setTemplateSwitch] = useState(false);

  const allChecked = itemA && itemB && itemC;
  const noneChecked = !itemA && !itemB && !itemC;
  const isIndeterminate = !allChecked && !noneChecked;

  const [radioValue, setRadioValue] = useState('a');

  const [switch1, setSwitch1] = useState(false);
  const [switch2, setSwitch2] = useState(true);
  const [switch3, setSwitch3] = useState(false);
  const [switch4, setSwitch4] = useState(true);

  return (
    <Surface className={styles.root} scrollable>
      <div className={styles.content}>
        <h2 className={buildClassName(styles.title, styles.fullWidth)}>Control Component Test</h2>

        <div className={buildClassName(styles.layoutPreview, styles.fullWidth)}>
          <Island>
            <IslandText>
              <h3 className={styles.sectionTitle}>Surface + Islands</h3>
              <div className={styles.previewCard}>
                <span className={styles.previewLabel}>Island</span>
                <span className={styles.previewText}>
                  Regular background, island radius, and 0.5rem padding.
                </span>
              </div>
            </IslandText>
          </Island>
          <IslandDescription>
            IslandDescription stays attached to the island above it, and the next island starts 1rem lower.
          </IslandDescription>
          <Island>
            <IslandText>
              <div className={styles.previewCard}>
                <span className={styles.previewLabel}>Island After Description</span>
                <span className={styles.previewText}>
                  This island verifies the description-to-island spacing rule.
                </span>
              </div>
            </IslandText>
          </Island>
          <Island>
            <IslandText>
              <div className={styles.previewCard}>
                <span className={styles.previewLabel}>Island After Island</span>
                <span className={styles.previewText}>
                  This island verifies the direct island-to-island 1rem gap.
                </span>
              </div>
            </IslandText>
          </Island>
        </div>

        {/* Bare primitives */}
        <Section title="Bare Primitives (no Control)">
          <div className={styles.barePrimitives}>
            <Checkbox checked={check1} onChange={setCheck1} />
            <Checkbox checked={check2} onChange={setCheck2} />
            <Checkbox checked={false} isInvalid onChange={setCheck1} />
            <Checkbox checked={false} disabled onChange={setCheck1} />
            <Checkbox checked onChange={setCheck1} isRound />
            <Checkbox checked={false} onChange={setCheck1} isRound />
            <Radio value="x" checked onChange={setRadioValue} name="bare" />
            <Radio value="y" checked={false} onChange={setRadioValue} name="bare" />
            <Radio value="z" checked={false} disabled onChange={setRadioValue} name="bare" />
            <Switch checked={switch1} onChange={setSwitch1} />
            <Switch checked={switch2} onChange={setSwitch2} />
            <Switch checked={permissionSwitch} withPermissionColors onChange={setPermissionSwitch} />
            <Switch checked withPermissionColors onChange={setSwitch1} />
            <Switch checked={false} disabled onChange={setSwitch1} />
          </div>
        </Section>

        <Section title="Templates">
          <CheckboxField
            checked={templateCheckbox}
            onChange={setTemplateCheckbox}
            label="Archive muted chats"
            description="New muted chats will skip the main list"
          />
          <CheckboxField
            checked={false}
            isInvalid
            onChange={setCheck1}
            label="Delete messages"
            description="This action is restricted for your role"
          />
          <SwitchField
            checked={templateSwitch}
            onChange={setTemplateSwitch}
            label="Translate messages"
            description="Offer inline translation when a different language is detected"
          />
          <SwitchField
            checked={permissionSwitch}
            withPermissionColors
            onChange={setPermissionSwitch}
            label="Pin messages"
            description={permissionSwitch ? 'Allowed for this role' : 'Denied for this role'}
          />
        </Section>

        {/* Interactive + Control with ControlLabel (auto-linked via context) */}
        <Section title="Interactive + Control + ControlLabel">
          <Interactive asLabel clickable>
            <Control>
              <Checkbox checked={check3} onChange={setCheck3} />
              <ControlLabel>Accept terms and conditions</ControlLabel>
            </Control>
          </Interactive>
          <Interactive asLabel clickable>
            <Control>
              <Checkbox checked={check4} onChange={setCheck4} />
              <ControlLabel>Remember me on this device</ControlLabel>
            </Control>
          </Interactive>
        </Section>

        {/* Radio in Control */}
        <Section title="Radio in Control">
          <Interactive asLabel clickable>
            <Control>
              <Checkbox checked={check1} onChange={setCheck1} />
              <ControlLabel>Click description to toggle</ControlLabel>
              <ControlDescription>Clicking anywhere toggles the checkbox</ControlDescription>
            </Control>
          </Interactive>
          <Interactive asLabel clickable>
            <Control>
              <Radio value="a" checked={radioValue === 'a'} onChange={setRadioValue} name="aslabel" />
              <ControlLabel>Option A</ControlLabel>
              <ControlDescription>Click anywhere on this field</ControlDescription>
            </Control>
          </Interactive>
          <Interactive asLabel clickable>
            <Control>
              <Radio value="b" checked={radioValue === 'b'} onChange={setRadioValue} name="aslabel" />
              <ControlLabel>Option B</ControlLabel>
              <ControlDescription>Including the description text</ControlDescription>
            </Control>
          </Interactive>
        </Section>

        {/* Control + Label + Description */}
        <Section title="Control + Label + Description">
          <Interactive asLabel clickable>
            <Control>
              <Checkbox checked={check5} onChange={setCheck5} />
              <ControlLabel>Keep signed in</ControlLabel>
              <ControlDescription>Your session will persist across browser restarts and device reboots</ControlDescription>
            </Control>
          </Interactive>
          <Interactive asLabel clickable>
            <Control>
              <Checkbox checked={check6} onChange={setCheck6} />
              <ControlLabel>Enable two-factor authentication</ControlLabel>
              <ControlDescription>Adds an extra layer of security</ControlDescription>
            </Control>
          </Interactive>
        </Section>

        {/* Round checkboxes */}
        <Section title="Round Checkboxes">
          <Interactive asLabel clickable>
            <Control>
              <Checkbox checked={checkRound1} onChange={setCheckRound1} isRound />
              <ControlLabel>Round checkbox</ControlLabel>
            </Control>
          </Interactive>
          <Interactive asLabel clickable>
            <Control>
              <Checkbox checked={checkRound2} onChange={setCheckRound2} isRound />
              <ControlLabel>Round pre-checked</ControlLabel>
              <ControlDescription>This one started checked</ControlDescription>
            </Control>
          </Interactive>
        </Section>

        {/* Indeterminate */}
        <Section title="Indeterminate State">
          <Interactive asLabel clickable>
            <Control>
              <Checkbox
                checked={allChecked}
                indeterminate={isIndeterminate}
                onChange={(v) => {
                  setItemA(v);
                  setItemB(v);
                  setItemC(v);
                }}
              />
              <ControlLabel>Select all</ControlLabel>
              <ControlDescription>
                {allChecked ? 'All selected' : noneChecked ? 'None selected' : 'Some selected'}
              </ControlDescription>
            </Control>
          </Interactive>
          <Interactive asLabel clickable>
            <Control>
              <Checkbox checked={itemA} onChange={setItemA} />
              <ControlLabel>Item A</ControlLabel>
            </Control>
          </Interactive>
          <Interactive asLabel clickable>
            <Control>
              <Checkbox checked={itemB} onChange={setItemB} />
              <ControlLabel>Item B</ControlLabel>
            </Control>
          </Interactive>
          <Interactive asLabel clickable>
            <Control>
              <Checkbox checked={itemC} onChange={setItemC} />
              <ControlLabel>Item C</ControlLabel>
            </Control>
          </Interactive>
        </Section>

        {/* Radio group */}
        <Section title="Radio Group">
          <Interactive asLabel clickable>
            <Control>
              <Radio value="a" checked={radioValue === 'a'} onChange={setRadioValue} name="demo" />
              <ControlLabel>Default spacing</ControlLabel>
              <ControlDescription>Standard spacing for most use cases</ControlDescription>
            </Control>
          </Interactive>
          <Interactive asLabel clickable>
            <Control>
              <Radio value="b" checked={radioValue === 'b'} onChange={setRadioValue} name="demo" />
              <ControlLabel>Comfortable</ControlLabel>
              <ControlDescription>More space between elements</ControlDescription>
            </Control>
          </Interactive>
          <Interactive asLabel clickable>
            <Control>
              <Radio value="c" checked={radioValue === 'c'} onChange={setRadioValue} name="demo" />
              <ControlLabel>Compact</ControlLabel>
              <ControlDescription>Minimal spacing for dense layouts</ControlDescription>
            </Control>
          </Interactive>
        </Section>

        {/* Switch */}
        <Section title="Switch">
          <Interactive asLabel clickable>
            <Control inputEnd>
              <Switch checked={switch1} onChange={setSwitch1} />
              <ControlLabel>Only Accept TON</ControlLabel>
            </Control>
          </Interactive>
          <Interactive asLabel clickable>
            <Control inputEnd>
              <Switch checked={switch2} onChange={setSwitch2} />
              <ControlLabel>Enable notifications</ControlLabel>
              <ControlDescription>Receive push notifications for new messages</ControlDescription>
            </Control>
          </Interactive>
          <Interactive asLabel clickable>
            <Control inputEnd>
              <Switch checked={switch3} onChange={setSwitch3} />
              <ControlLabel>Auto-download media</ControlLabel>
            </Control>
          </Interactive>
          <Interactive asLabel clickable>
            <Control inputEnd>
              <Switch checked={switch4} onChange={setSwitch4} />
              <ControlLabel>
                This is a long label that wraps to multiple lines to verify vertical centering with the switch
              </ControlLabel>
              <ControlDescription>And a description underneath for good measure</ControlDescription>
            </Control>
          </Interactive>
          <Interactive asLabel clickable disabled>
            <Control inputEnd>
              <Switch checked onChange={setSwitch1} />
              <ControlLabel>Disabled switch (on)</ControlLabel>
            </Control>
          </Interactive>
          <Interactive asLabel clickable loading>
            <Control inputEnd>
              <Switch checked={false} onChange={setSwitch1} />
              <ControlLabel>Loading switch</ControlLabel>
              <ControlDescription>Spinner replaces the switch</ControlDescription>
            </Control>
          </Interactive>
        </Section>

        {/* Disabled */}
        <Section title="Disabled">
          <Interactive asLabel clickable disabled>
            <Control>
              <Checkbox checked={false} onChange={setCheck1} />
              <ControlLabel>Disabled unchecked</ControlLabel>
            </Control>
          </Interactive>
          <Interactive asLabel clickable disabled>
            <Control>
              <Checkbox checked onChange={setCheck1} />
              <ControlLabel>Disabled checked</ControlLabel>
              <ControlDescription>This option is currently unavailable</ControlDescription>
            </Control>
          </Interactive>
          <Interactive asLabel clickable disabled>
            <Control>
              <Radio value="dis" checked onChange={setRadioValue} name="disabled" />
              <ControlLabel>Disabled radio</ControlLabel>
            </Control>
          </Interactive>
        </Section>

        {/* inputEnd */}
        <Section title="Input at End (inputEnd)">
          <Interactive asLabel clickable>
            <Control inputEnd>
              <Checkbox checked={check7} onChange={setCheck7} />
              <ControlLabel>Enable notifications</ControlLabel>
              <ControlDescription>Receive alerts for new messages</ControlDescription>
            </Control>
          </Interactive>
          <Interactive asLabel clickable>
            <Control inputEnd>
              <Checkbox checked={check8} onChange={setCheck8} />
              <ControlLabel>Auto-download media</ControlLabel>
            </Control>
          </Interactive>
          <Interactive asLabel clickable disabled>
            <Control inputEnd>
              <Checkbox checked onChange={setCheck1} />
              <ControlLabel>Disabled at end</ControlLabel>
              <ControlDescription>Cannot toggle this</ControlDescription>
            </Control>
          </Interactive>
        </Section>

        {/* ControlAfter */}
        <Section title="ControlAfter Helper">
          <Interactive asLabel clickable>
            <Control>
              <Checkbox checked={check9} onChange={setCheck9} />
              <ControlLabel>Notifications</ControlLabel>
              <ControlDescription>Get notified about updates</ControlDescription>
              <ControlAfter>
                <span style="display: inline-flex; align-items: center; justify-content: center; width: 1.5rem; height: 1.5rem; border-radius: 50%; background: var(--color-primary); color: white; font-size: 0.75rem">
                  3
                </span>
              </ControlAfter>
            </Control>
          </Interactive>
          <Interactive asLabel clickable>
            <Control inputEnd>
              <Checkbox checked={check7} onChange={setCheck7} />
              <ControlLabel>inputEnd + after</ControlLabel>
              <ControlAfter>
                <span style="font-size: 1.25rem">⚡</span>
              </ControlAfter>
            </Control>
          </Interactive>
        </Section>

        {/* ControlBefore */}
        <Section title="ControlBefore Helper">
          <Interactive asLabel clickable>
            <Control>
              <Radio value="a" checked={radioValue === 'a'} onChange={setRadioValue} name="before" />
              <ControlBefore>
                <div style="width: 2rem; height: 2rem; border-radius: 50%; background: #3390ec; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem">
                  AB
                </div>
              </ControlBefore>
              <ControlLabel>Alice Brown</ControlLabel>
              <ControlDescription>Online</ControlDescription>
            </Control>
          </Interactive>
          <Interactive asLabel clickable>
            <Control>
              <Radio value="b" checked={radioValue === 'b'} onChange={setRadioValue} name="before" />
              <ControlBefore>
                <div style="width: 2rem; height: 2rem; border-radius: 50%; background: #e06c75; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem">
                  CD
                </div>
              </ControlBefore>
              <ControlLabel>Charlie Davis</ControlLabel>
              <ControlDescription>Last seen recently</ControlDescription>
            </Control>
          </Interactive>
        </Section>

        {/* ControlBefore + ControlAfter */}
        <Section title="ControlBefore + ControlAfter Combined">
          <Interactive asLabel clickable>
            <Control>
              <Checkbox checked={check4} onChange={setCheck4} />
              <ControlBefore>
                <div style="width: 2rem; height: 2rem; border-radius: 50%; background: #61afef; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem">
                  JD
                </div>
              </ControlBefore>
              <ControlLabel>John Doe</ControlLabel>
              <ControlDescription>Admin</ControlDescription>
              <ControlAfter>
                <span style="font-size: 0.75rem; color: var(--color-text-secondary)">Owner</span>
              </ControlAfter>
            </Control>
          </Interactive>
        </Section>

        {/* Long content */}
        <Section title="Long Content (centering test)">
          <Interactive asLabel clickable>
            <Control>
              <Checkbox checked={check5} onChange={setCheck5} />
              <ControlLabel>
                This is a very long label text that should wrap to multiple lines to verify the checkbox stays vertically centered
              </ControlLabel>
              <ControlDescription>
                And this description is also quite long to demonstrate that the checkbox centers between the label and description areas correctly even with significant text content
              </ControlDescription>
            </Control>
          </Interactive>
          <Interactive asLabel clickable>
            <Control inputEnd>
              <Checkbox checked={check6} onChange={setCheck6} />
              <ControlLabel>
                Another long label to test inputEnd centering with wrapping text content
              </ControlLabel>
              <ControlDescription>
                Description wrapping for the inputEnd variant showing the checkbox on the right side
              </ControlDescription>
            </Control>
          </Interactive>
        </Section>

        {/* Loading */}
        <Section title="Loading State">
          <Interactive asLabel clickable loading>
            <Control>
              <Checkbox checked={false} onChange={setCheck1} />
              <ControlLabel>Loading (label only)</ControlLabel>
            </Control>
          </Interactive>
          <Interactive asLabel clickable loading>
            <Control>
              <Checkbox checked onChange={setCheck1} />
              <ControlLabel>Loading with description</ControlLabel>
              <ControlDescription>Spinner replaces the checkbox</ControlDescription>
            </Control>
          </Interactive>
          <Interactive asLabel clickable loading>
            <Control inputEnd>
              <Checkbox checked={false} onChange={setCheck1} />
              <ControlLabel>Loading at end</ControlLabel>
              <ControlDescription>inputEnd + loading</ControlDescription>
            </Control>
          </Interactive>
          <Interactive asLabel clickable loading>
            <Control>
              <Radio value="x" checked onChange={setRadioValue} name="loading" />
              <ControlLabel>Loading radio</ControlLabel>
              <ControlDescription>Spinner replaces the radio button</ControlDescription>
            </Control>
          </Interactive>
        </Section>

        {/* Control without Interactive */}
        <Section noBorder title="Control without Interactive (no padding/hover)">
          <div className={styles.bareControl}>
            <Control>
              <Checkbox checked={check2} onChange={setCheck2} />
              <ControlLabel>Bare field, custom container</ControlLabel>
              <ControlDescription>
                Control only handles grid layout
                <br />
                Description is clickable too
              </ControlDescription>
            </Control>
          </div>
        </Section>
      </div>
    </Surface>
  );
};

export default FieldDemo;
