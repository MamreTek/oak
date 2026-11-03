import type { ScriptCheck, ScriptType } from './contracts';

export const demoScripts: Record<ScriptType, string> = {
  shell:
    '#!/bin/sh\n# DEMO ONLY: editable text, never executed by Oak.\nprintf "demo installation plan\\n"\n',
  kickstart:
    '# DEMO ONLY: not an executable installation file.\nlang en_US.UTF-8\ntimezone UTC\nrootpw --lock\n%packages\n@core\n%end\n',
  python:
    '#!/usr/bin/env python3\n# DEMO ONLY: editable text, never executed by Oak.\nprint("demo installation plan")\n',
};
export function checkScript(type: ScriptType, content: string): ScriptCheck {
  const issues: string[] = [];
  if (!content.trim()) issues.push('内容不能为空');
  if (content.length > 20000) issues.push('内容最多 20000 字符');
  if (content.includes('\0')) issues.push('不允许 NUL 字符');
  if (
    /-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*\S+/i.test(
      content,
    ) ||
    /^\s*rootpw\s+(?!--lock\s*$)/m.test(content)
  )
    issues.push('请移除疑似凭据或私钥；原型只允许虚构、无秘密的脚本文本');
  if (type === 'shell' && !/^#!\s*\/(?:usr\/bin\/env\s+|bin\/)(?:ba)?sh(?:\s|$)/.test(content))
    issues.push('Shell 文本需以 sh 或 bash shebang 开头');
  if (type === 'kickstart') {
    if (!/^lang\s+\S+/m.test(content)) issues.push('Kickstart 基础检查要求 lang 指令');
    let open = false;
    for (const line of content.split(/\r?\n/)) {
      if (/^%(packages|pre|post)(\s|$)/.test(line)) {
        if (open) issues.push('Kickstart 段不可嵌套');
        open = true;
      }
      if (/^%end\s*$/.test(line)) {
        if (!open) issues.push('存在无对应起始段的 %end');
        open = false;
      }
    }
    if (open) issues.push('Kickstart 段缺少 %end');
  }
  if (type === 'python' && /^#!.*\b(?:ba)?sh\s*$/m.test(content))
    issues.push('Python 文本不能使用 Shell shebang');
  if (type === 'python' && content.split(/\r?\n/).some((line) => /^(?: +\t|\t+ )/.test(line)))
    issues.push('请勿混合空格和 Tab 缩进');
  return {
    valid: issues.length === 0,
    issues: [...new Set(issues)],
    limitation:
      '仅基础文本检查；未解析完整语法、未执行、未验证安装兼容性，也不是完备的秘密检测。请勿输入生产脚本或真实凭据。',
  };
}
export function ipv4Number(value: string): number | null {
  if (!/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(value)) return null;
  const parts = value.split('.').map(Number);
  return parts.some((part) => part > 255)
    ? null
    : parts.reduce((result, part) => result * 256 + part, 0);
}
export const ipv4Text = (value: number) =>
  [24, 16, 8, 0].map((shift) => Math.floor(value / 2 ** shift) % 256).join('.');
export function subnetRange(cidr: string): { first: number; last: number } | null {
  const match = /^(.*)\/(\d{1,2})$/.exec(cidr);
  if (!match) return null;
  const ip = ipv4Number(match[1]);
  const prefix = Number(match[2]);
  if (ip === null || prefix < 24 || prefix > 30) return null;
  const size = 2 ** (32 - prefix);
  const allowed = ['192.0.2.0', '198.51.100.0', '203.0.113.0'].some(
    (base) => ip >= ipv4Number(base)! && ip + size - 1 < ipv4Number(base)! + 256,
  );
  return allowed && ip % size === 0 ? { first: ip, last: ip + size - 1 } : null;
}
