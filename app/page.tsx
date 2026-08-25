'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Task = {
  id: string;
  text: string;
  done: boolean;
};

type TasksByDate = Record<string, Task[]>;

const STORAGE_KEY = 't-day-state-v1';
const DEFAULT_TITLE = '项目上线';
const DEFAULT_TARGET = '2026-09-01T09:00';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDateKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatFullDate(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(date);
}

function formatDayLabel(key: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(parseDateKey(key));
}

function daysBetween(start: Date, end: Date) {
  const diff = startOfDay(end).getTime() - startOfDay(start).getTime();
  return Math.max(0, Math.round(diff / MS_PER_DAY) + 1);
}

function mondayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

function monthLabel(year: number, month: number) {
  return `${year}年${month + 1}月`;
}

function buildMonths(now: Date, target: Date) {
  const start = startOfDay(now);
  const end = startOfDay(target);
  if (end.getTime() < start.getTime()) return [];

  const todayKey = dateKey(start);
  const targetKey = dateKey(end);
  const months = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor.getTime() <= last.getTime()) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    let inRangeCount = 0;

    for (let i = 0; i < mondayIndex(new Date(year, month, 1)); i += 1) {
      cells.push({ key: null, day: 0, inRange: false, isToday: false, isTarget: false });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const current = new Date(year, month, day);
      const key = dateKey(current);
      const time = startOfDay(current).getTime();
      const inRange = time >= start.getTime() && time <= end.getTime();
      if (inRange) inRangeCount += 1;
      cells.push({
        key,
        day,
        inRange,
        isToday: key === todayKey,
        isTarget: key === targetKey,
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ key: null, day: 0, inRange: false, isToday: false, isTarget: false });
    }

    const activeRows = [];
    for (let i = 0; i < cells.length; i += 7) {
      const row = cells.slice(i, i + 7);
      if (row.some((cell) => cell.inRange)) activeRows.push(...row);
    }

    if (inRangeCount > 0) {
      months.push({
        id: `${year}-${month}`,
        label: monthLabel(year, month),
        cells: activeRows,
        inRangeCount,
      });
    }

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function buildPickerCells(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const cells = [];
  for (let i = 0; i < mondayIndex(new Date(year, month, 1)); i += 1) {
    cells.push(null);
  }
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function Home() {
  const [now, setNow] = useState(() => new Date());
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [targetValue, setTargetValue] = useState(DEFAULT_TARGET);
  const [tasks, setTasks] = useState<TasksByDate>({});
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(DEFAULT_TITLE);
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [taskDate, setTaskDate] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState('');
  const [pickerMonth, setPickerMonth] = useState(() => new Date(DEFAULT_TARGET));
  const [selectedTargetKey, setSelectedTargetKey] = useState(() => dateKey(new Date(DEFAULT_TARGET)));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        title?: string;
        targetValue?: string;
        tasks?: TasksByDate;
      };
      if (parsed.title) {
        setTitle(parsed.title);
        setTitleDraft(parsed.title);
      }
      if (parsed.targetValue) {
        setTargetValue(parsed.targetValue);
        setSelectedTargetKey(dateKey(new Date(parsed.targetValue)));
        setPickerMonth(new Date(parsed.targetValue));
      }
      if (parsed.tasks) setTasks(parsed.tasks);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ title, targetValue, tasks }),
    );
  }, [title, targetValue, tasks]);

  const target = useMemo(() => new Date(targetValue), [targetValue]);
  const remainingMs = Math.max(0, target.getTime() - now.getTime());
  const remainingDays = Math.floor(remainingMs / MS_PER_DAY);
  const months = useMemo(() => buildMonths(now, target), [now, target]);
  const totalDays = daysBetween(now, target);
  const allTasks = Object.values(tasks).flat();
  const doneCount = allTasks.filter((task) => task.done).length;
  const progress = allTasks.length ? Math.round((doneCount / allTasks.length) * 100) : 0;
  const todayTasks = tasks[dateKey(now)] ?? [];

  function saveTitle() {
    const next = titleDraft.trim() || DEFAULT_TITLE;
    setTitle(next);
    setTitleDraft(next);
    setEditingTitle(false);
  }

  function openDateDialog() {
    const current = new Date(targetValue);
    setSelectedTargetKey(dateKey(current));
    setPickerMonth(current);
    setDateDialogOpen(true);
  }

  function applyTargetDate() {
    const selected = parseDateKey(selectedTargetKey);
    selected.setHours(9, 0, 0, 0);
    setTargetValue(`${dateKey(selected)}T09:00`);
    setDateDialogOpen(false);
  }

  function addTask(event: FormEvent) {
    event.preventDefault();
    if (!taskDate) return;
    const text = taskDraft.trim();
    if (!text) return;
    setTasks((current) => ({
      ...current,
      [taskDate]: [
        ...(current[taskDate] ?? []),
        { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, text, done: false },
      ],
    }));
    setTaskDraft('');
  }

  function toggleTask(key: string, taskId: string) {
    setTasks((current) => ({
      ...current,
      [key]: (current[key] ?? []).map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task,
      ),
    }));
  }

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-[#1a1a1a]">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
        <header className="grid items-end gap-8 pb-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12">
          <div className="flex min-w-0 flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
              T-Day
            </p>
            {editingTitle ? (
              <input
                autoFocus
                className="title-input"
                value={titleDraft}
                onBlur={saveTitle}
                onChange={(event) => setTitleDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') saveTitle();
                  if (event.key === 'Escape') {
                    setTitleDraft(title);
                    setEditingTitle(false);
                  }
                }}
              />
            ) : (
              <button
                aria-label={`修改事项名称，当前为 ${title}`}
                className="title-button"
                type="button"
                onClick={() => setEditingTitle(true)}
              >
                <span>{title}</span>
                <span className="title-pencil">✎</span>
              </button>
            )}
            <p className="text-sm text-neutral-500 sm:text-base">
              距离 {formatFullDate(target)}
            </p>
          </div>

          <button
            aria-label="点击设置目标时间"
            className="countdown-button"
            type="button"
            onClick={openDateDialog}
          >
            <span className="countdown-number">{remainingDays}</span>
            <span className="countdown-unit">天</span>
            <span className="countdown-hint">点击设置时间</span>
          </button>
        </header>

        <section className="calendar-card">
          <div className="calendar-heading">
            <h2>▣ 倒计时期间的安排</h2>
            <p>
              共 <strong>{totalDays}</strong> 天（含今天与目标日）· 点击日期添加待办
            </p>
          </div>

          <div className="progress-row">
            <span>任务进度</span>
            <div className="progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
            <strong>{progress}%</strong>
          </div>

          {todayTasks.length > 0 && (
            <div className="today-strip">
              <span>今日重点</span>
              {todayTasks.slice(0, 3).map((task) => (
                <button
                  key={task.id}
                  className={task.done ? 'mini-task is-done' : 'mini-task'}
                  type="button"
                  onClick={() => toggleTask(dateKey(now), task.id)}
                >
                  {task.text}
                </button>
              ))}
            </div>
          )}

          <div className="months">
            {months.map((month) => (
              <section className="month" key={month.id}>
                <div className="month-title">
                  <h3>{month.label}</h3>
                  <span>{month.inRangeCount} 天在倒计时内</span>
                </div>
                <div className="weekdays">
                  {WEEKDAYS.map((weekday) => (
                    <span key={weekday}>{weekday}</span>
                  ))}
                </div>
                <div className="day-grid">
                  {month.cells.map((cell, index) => {
                    const dayTasks = cell.key ? tasks[cell.key] ?? [] : [];
                    if (!cell.key) {
                      return <div className="day-cell is-empty" key={`${month.id}-${index}`} />;
                    }
                    if (!cell.inRange) {
                      return (
                        <div className="day-cell is-outside" key={cell.key}>
                          <span>{cell.day}</span>
                        </div>
                      );
                    }
                    return (
                      <button
                        className="day-cell is-active"
                        key={cell.key}
                        type="button"
                        onClick={() => setTaskDate(cell.key)}
                      >
                        <span className="day-top">
                          <strong>{cell.day}</strong>
                          {cell.isToday && <em>今天</em>}
                          {cell.isTarget && <em className="is-target">目标</em>}
                        </span>
                        {dayTasks.length > 0 ? (
                          <span className="task-preview">
                            {dayTasks.slice(0, 2).map((task) => (
                              <small className={task.done ? 'is-done' : ''} key={task.id}>
                                {task.text}
                              </small>
                            ))}
                          </span>
                        ) : (
                          <span className="add-hint">添加安排</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>
      </section>

      {dateDialogOpen && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="modal date-modal" role="dialog">
            <button className="close-button" type="button" onClick={() => setDateDialogOpen(false)}>
              Close
            </button>
            <h2>选择目标日期</h2>
            <p>点选一个日期后按「确认」，倒计时会以当日 09:00 为终点重新计算。</p>
            <div className="picker-top">
              <button
                type="button"
                onClick={() =>
                  setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() - 1, 1))
                }
              >
                ‹
              </button>
              <strong>{monthLabel(pickerMonth.getFullYear(), pickerMonth.getMonth())}</strong>
              <button
                type="button"
                onClick={() =>
                  setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 1))
                }
              >
                ›
              </button>
            </div>
            <div className="picker-weekdays">
              {WEEKDAYS.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>
            <div className="picker-grid">
              {buildPickerCells(pickerMonth).map((cell, index) => {
                if (!cell) return <span key={index} />;
                const key = dateKey(cell);
                const disabled = startOfDay(cell).getTime() < startOfDay(now).getTime();
                return (
                  <button
                    className={key === selectedTargetKey ? 'is-selected' : ''}
                    disabled={disabled}
                    key={key}
                    type="button"
                    onClick={() => setSelectedTargetKey(key)}
                  >
                    {cell.getDate()}
                  </button>
                );
              })}
            </div>
            <p className="target-note">目标日：{formatDayLabel(selectedTargetKey)}（当日 09:00 到点）</p>
            <div className="modal-actions">
              <button type="button" onClick={() => setDateDialogOpen(false)}>
                取消
              </button>
              <button type="button" onClick={applyTargetDate}>
                确认
              </button>
            </div>
          </section>
        </div>
      )}

      {taskDate && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="modal task-modal" role="dialog">
            <button className="close-button" type="button" onClick={() => setTaskDate(null)}>
              Close
            </button>
            <h2>{formatDayLabel(taskDate)}</h2>
            {(tasks[taskDate] ?? []).length === 0 ? (
              <p>这一天还没有安排，添加你要完成的事情。</p>
            ) : (
              <div className="task-list">
                {(tasks[taskDate] ?? []).map((task) => (
                  <label className={task.done ? 'task-row is-done' : 'task-row'} key={task.id}>
                    <input
                      checked={task.done}
                      type="checkbox"
                      onChange={() => toggleTask(taskDate, task.id)}
                    />
                    <span>{task.text}</span>
                  </label>
                ))}
              </div>
            )}
            <form className="task-form" onSubmit={addTask}>
              <input
                placeholder="例如：写需求文档、复习第三章"
                value={taskDraft}
                onChange={(event) => setTaskDraft(event.target.value)}
              />
              <button type="submit">添加待办</button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
