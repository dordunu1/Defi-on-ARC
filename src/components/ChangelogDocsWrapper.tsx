import { useState, useEffect } from 'react';
import Changelog from './Changelog';
import Docs from './Docs';

interface ChangelogDocsWrapperProps {
  docsOpen?: boolean;
  onDocsOpenChange?: (open: boolean) => void;
}

export default function ChangelogDocsWrapper({ docsOpen: externalDocsOpen, onDocsOpenChange }: ChangelogDocsWrapperProps = {}) {
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [internalDocsOpen, setInternalDocsOpen] = useState(false);
  
  // Use external state if provided, otherwise use internal state
  const docsOpen = externalDocsOpen !== undefined ? externalDocsOpen : internalDocsOpen;
  const setDocsOpen = onDocsOpenChange || setInternalDocsOpen;

  // Sync external state changes
  useEffect(() => {
    if (externalDocsOpen !== undefined) {
      setInternalDocsOpen(externalDocsOpen);
    }
  }, [externalDocsOpen]);

  return (
    <>
      <Changelog docsOpen={docsOpen} onOpenChange={setChangelogOpen} />
      <Docs changelogOpen={changelogOpen} isOpen={docsOpen} onOpenChange={setDocsOpen} />
    </>
  );
}
