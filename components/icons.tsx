import { Code2, Bot, Github, FileText, Terminal, BrainCircuit, type LucideProps } from 'lucide-react';

export const Icons = {
  Logo: (props: LucideProps) => <BrainCircuit {...props} />,
  Bot: (props: LucideProps) => <Bot {...props} />,
  Code: (props: LucideProps) => <Code2 {...props} />,
  GitHub: (props: LucideProps) => <Github {...props} />,
  FileText: (props: LucideProps) => <FileText {...props} />,
  Terminal: (props: LucideProps) => <Terminal {...props} />,
};

export default Icons;
