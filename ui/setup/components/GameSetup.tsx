import React, { useState } from 'react';

export default ({ update }: { update: (s: any) => void }) => {
  const [setup, updateSetup] = useState<Record<string, any>>({});

  const updateSetupKey = (key: string, value: any) => {
    updateSetup(s => Object.assign(s, { [key]: value }));
    update(setup);
  }

  return (
    <input value={setup.a} onChange={e => updateSetupKey('a', e.target.value)}/>
  );
}
