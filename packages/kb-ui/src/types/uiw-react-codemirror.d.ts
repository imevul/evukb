declare module '@uiw/react-codemirror' {
  import type { Extension } from '@codemirror/state';
  import type { ViewUpdate } from '@codemirror/view';
  import type { ComponentType } from 'react';

  export type ReactCodeMirrorProps = {
    basicSetup?: boolean | Record<string, boolean>;
    className?: string;
    editable?: boolean;
    extensions?: Extension[];
    height?: string;
    onChange?: (value: string, viewUpdate: ViewUpdate) => void;
    onUpdate?: (viewUpdate: ViewUpdate) => void;
    theme?: string;
    value?: string;
  };

  const ReactCodeMirror: ComponentType<ReactCodeMirrorProps>;
  export default ReactCodeMirror;
}
