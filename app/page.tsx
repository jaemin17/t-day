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
const INITIAL_NOW = new Date(2026, 7, 25, 12, 0, 0);
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const DATE_STAMP_HELP = [
  ['1. 只保存在当前浏览器。', '不会上传或同步到其它设备。'],
  ['2. 适合临时目标和每日安排。', '重要记录建议另行备份。'],
  ['3. 清除浏览器数据或换设备后，', '已保存的内容可能会消失。'],
];

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

function formatDateStamp(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.weekday} ${byType.day} ${byType.month} ${byType.year}`;
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
  const [now, setNow] = useState(INITIAL_NOW);
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [targetValue, setTargetValue] = useState(DEFAULT_TARGET);
  const [tasks, setTasks] = useState<TasksByDate>({});
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(DEFAULT_TITLE);
  const [dateHelpOpen, setDateHelpOpen] = useState(false);
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [taskDate, setTaskDate] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState('');
  const [pickerMonth, setPickerMonth] = useState(() => new Date(DEFAULT_TARGET));
  const [selectedTargetKey, setSelectedTargetKey] = useState(() => dateKey(new Date(DEFAULT_TARGET)));

  useEffect(() => {
    setNow(new Date());
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
  const months = useMemo(() => buildMonths(now, target), [now, target]);
  const totalDays = daysBetween(now, target);
  const remainingDays = totalDays;
  const todayTasks = tasks[dateKey(now)] ?? [];
  const todayKey = dateKey(now);

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
    <main className="relative min-h-screen bg-background text-[#1a1a1a]">
      <div className="date-stamp-group">
        <div className="date-stamp-row">
          <time className="date-stamp" dateTime={todayKey}>
            <em>{formatDateStamp(now)}</em>
          </time>
          <button
            aria-controls="date-storage-help"
            aria-expanded={dateHelpOpen}
            aria-label="存储说明"
            className="date-storage-help-button"
            type="button"
            onClick={() => setDateHelpOpen((open) => !open)}
          >
            <svg
              aria-hidden="true"
              className="date-storage-help-icon"
              focusable="false"
              viewBox="0 0 1024 1024"
            >
              <path d="M755.9 77.1H268.1c-112 0-203.2 91.2-203.2 203.2v325.1c0 112 91.2 203.2 203.2 203.2h124.1L512 946.9l119.8-138.3h124.1c112 0 203.2-91.2 203.2-203.2V280.3c0-112.1-91.2-203.2-203.2-203.2z m121.9 528.3c0 67.2-54.7 121.9-121.9 121.9H594.6L512 822.8l-82.6-95.4H268.1c-67.2 0-121.9-54.7-121.9-121.9V280.3c0-67.2 54.7-121.9 121.9-121.9h487.7c67.2 0 121.9 54.7 121.9 121.9v325.1z" />
              <path d="M527.5 253.5c-84.4-3.9-134.4 33.8-150 113l56.5 13.6c11.7-51.9 40.2-77.9 85.7-77.9 37.7 2.6 58.4 22.1 62.3 58.4 1.3 26-16.2 52-52.6 77.9-35.1 23.4-52 53.9-50.7 91.6v19.5h52.6V534c-1.3-27.3 13-50.7 42.9-70.1 50.7-31.2 74.7-67.5 72.1-109.1-7.8-63.6-47.4-97.4-118.8-101.3zM472.9 596.4h64.3v62.3h-64.3z" />
            </svg>
          </button>
        </div>
        {dateHelpOpen && (
          <div className="date-storage-help-panel" id="date-storage-help">
            {DATE_STAMP_HELP.map(([titleLine, bodyLine]) => (
              <p key={titleLine}>
                <strong>{titleLine}</strong>
                <span>{bodyLine}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
        <header className="grid items-end gap-6 pb-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-8">
          <div className="flex min-w-0 flex-col gap-3">
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
              </button>
            )}
          </div>

          <button
            aria-label="点击设置目标时间"
            className="countdown-button"
            type="button"
            onClick={openDateDialog}
          >
            <span className="countdown-number">{remainingDays}</span>
            <span className="countdown-unit">天</span>
          </button>
        </header>

        <section className="calendar-card">
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
