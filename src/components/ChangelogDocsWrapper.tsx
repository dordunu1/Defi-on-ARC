import { useState } from 'react';
import Changelog from './Changelog';
import Docs from './Docs';

export default function ChangelogDocsWrapper() {
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);

  return (
    <>
      <Changelog docsOpen={docsOpen} onOpenChange={setChangelogOpen} />
      <Docs changelogOpen={changelogOpen} onOpenChange={setDocsOpen} />
    </>
  );
}
