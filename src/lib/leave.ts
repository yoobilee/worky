export type LeaveStandard = 'join_date' | 'fiscal_year';

export interface LeaveResult {
  total: number;
  breakdown: string;
}

export function calcAnnualLeave(joinDateStr: string, standard: LeaveStandard): LeaveResult {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const join = new Date(joinDateStr);
  join.setHours(0, 0, 0, 0);

  return standard === 'join_date'
    ? calcByJoinDate(join, today)
    : calcByFiscalYear(join, today);
}

function completedMonths(from: Date, to: Date): number {
  const years = to.getFullYear() - from.getFullYear();
  const months = to.getMonth() - from.getMonth();
  const days = to.getDate() - from.getDate();
  return years * 12 + months + (days < 0 ? -1 : 0);
}

function completedYears(from: Date, to: Date): number {
  let years = to.getFullYear() - from.getFullYear();
  const m = to.getMonth() - from.getMonth();
  if (m < 0 || (m === 0 && to.getDate() < from.getDate())) years--;
  return years;
}

function leaveByFullYears(fullYears: number): number {
  return Math.min(15 + Math.floor((fullYears - 1) / 2), 25);
}

function calcByJoinDate(join: Date, today: Date): LeaveResult {
  const fullYears = completedYears(join, today);
  if (fullYears < 1) {
    const months = Math.min(completedMonths(join, today), 11);
    return { total: months, breakdown: `월별 ${months}일` };
  }
  const total = leaveByFullYears(fullYears);
  return { total, breakdown: `근속 ${fullYears}년 기준 ${total}일` };
}

function calcByFiscalYear(join: Date, today: Date): LeaveResult {
  const firstJan1 = new Date(join.getFullYear() + 1, 0, 1);

  if (today < firstJan1) {
    const months = Math.min(completedMonths(join, today), 11);
    return { total: months, breakdown: `월별 ${months}일` };
  }

  const anniversary = new Date(join.getFullYear() + 1, join.getMonth(), join.getDate());

  if (today < anniversary) {
    const dec31 = new Date(join.getFullYear(), 11, 31);
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysInFirstPeriod = Math.floor((dec31.getTime() - join.getTime()) / msPerDay) + 1;
    const proportional = Math.round(15 * daysInFirstPeriod / 365 * 2) / 2;
    const monthlyExtra = completedMonths(firstJan1, today);
    const total = proportional + monthlyExtra;
    return {
      total,
      breakdown: `비례 ${proportional}일 + 월별 ${monthlyExtra}일`,
    };
  }

  const fullYears = completedYears(join, today);
  const total = leaveByFullYears(fullYears);
  return { total, breakdown: `근속 ${fullYears}년 기준 ${total}일` };
}
