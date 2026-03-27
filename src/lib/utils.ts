import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`
  }
  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`
  }
  return `₹${amount.toFixed(0)}`
}

export function getHealthColor(score: number): string {
  if (score >= 75) return 'hsl(160 84% 39%)'
  if (score >= 50) return 'hsl(38 92% 50%)'
  return 'hsl(0 72% 51%)'
}

export function getHealthLabel(score: number): string {
  if (score >= 75) return 'Healthy'
  if (score >= 50) return 'At Risk'
  return 'Critical'
}

export function getHealthClass(score: number): string {
  if (score >= 75) return 'status-success'
  if (score >= 50) return 'status-warning'
  return 'status-critical'
}

export function getPriorityClass(priority: string): string {
  switch (priority) {
    case 'critical': return 'status-critical'
    case 'high': return 'status-warning'
    case 'medium': return 'status-info'
    default: return 'status-success'
  }
}
