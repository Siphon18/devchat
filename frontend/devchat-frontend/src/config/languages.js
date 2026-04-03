export const LANGUAGES = [
  { value: "python", label: "Python", icon: "Py", monacoLang: "python" },
  { value: "javascript", label: "JavaScript", icon: "Js", monacoLang: "javascript" },
  { value: "typescript", label: "TypeScript", icon: "Ts", monacoLang: "typescript" },
  { value: "java", label: "Java", icon: "Jv", monacoLang: "java" },
  { value: "c", label: "C", icon: "C", monacoLang: "c" },
  { value: "cpp", label: "C++", icon: "C+", monacoLang: "cpp" },
  { value: "go", label: "Go", icon: "Go", monacoLang: "go" },
  { value: "rust", label: "Rust", icon: "Rs", monacoLang: "rust" },
];

export const DEFAULT_LANGUAGE = "python";

export const STARTER_CODE = {
  python: 'print("Hello, World!")',
  javascript: 'console.log("Hello, World!");',
  typescript: 'const msg: string = "Hello, World!";\nconsole.log(msg);',
  java: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello, World!");\n  }\n}',
  c: '#include <stdio.h>\n\nint main() {\n  printf("Hello, World!\\n");\n  return 0;\n}',
  cpp: '#include <iostream>\n\nint main() {\n  std::cout << "Hello, World!" << std::endl;\n  return 0;\n}',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("Hello, World!")\n}',
  rust: 'fn main() {\n  println!("Hello, World!");\n}',
};

export function getLanguageMeta(language) {
  return LANGUAGES.find((item) => item.value === language) || LANGUAGES[0];
}
