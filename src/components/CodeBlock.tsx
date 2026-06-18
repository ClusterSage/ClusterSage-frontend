import { CopyButton } from "./CopyButton";
export function CodeBlock({ value }: { value: string }) {
  return <div className="space-y-3"><div className="flex justify-end"><CopyButton text={value} /></div><pre className="codeblock"><code>{value}</code></pre></div>;
}
