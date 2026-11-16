import type { Installation } from './contracts';

const phases = [
  ['preflight', '资源预检'],
  ['boot', '准备引导'],
  ['image', '镜像准备'],
  ['install', '系统安装'],
  ['handoff', '交付检查'],
] as const;

// Query-driven simulation only. No timers, scripts, downloads or device access.
export function updateInstallationProgress(task: Installation, duration: number) {
  const elapsed = Math.max(0, Date.now() - Date.parse(task.createdAt));
  const failureTime = duration * 0.6;
  const failed = task.simulateFailure && elapsed >= failureTime;
  const terminal = failed || elapsed >= duration;
  const end = failed ? failureTime : Math.min(elapsed, duration);
  const at = (offset: number) => new Date(Date.parse(task.createdAt) + offset).toISOString();
  task.progress = Math.min(failed ? 60 : 100, Math.floor((elapsed / duration) * 100));
  task.status = failed ? 'failed' : terminal ? 'succeeded' : 'running';
  task.failureReason = failed ? '模拟镜像校验失败；未安装真实系统。请核对演示镜像后重试。' : null;
  task.events = [];
  task.stages = phases.map(([key, label], index) => {
    const start = (duration * index) / phases.length;
    const finish = (duration * (index + 1)) / phases.length;
    const skipped = failed && index > 2;
    const stageFailed = failed && index === 2;
    const started = !skipped && end >= start && !(terminal && start > end);
    const done = !skipped && end >= finish;
    if (started)
      task.events.push({
        at: at(start),
        stage: key,
        level: 'info',
        message: `${label}开始（模拟）`,
      });
    if (done || stageFailed)
      task.events.push({
        at: at(finish),
        stage: key,
        level: stageFailed ? 'error' : 'info',
        message: stageFailed ? task.failureReason! : `${label}完成（模拟）`,
      });
    return {
      key,
      label,
      status: skipped
        ? 'skipped'
        : stageFailed
          ? 'failed'
          : done
            ? 'succeeded'
            : started
              ? 'running'
              : 'pending',
      startedAt: started ? at(start) : null,
      finishedAt: done || stageFailed ? at(finish) : null,
    };
  });
  task.logs = task.events.map((event) => event.message);
}
