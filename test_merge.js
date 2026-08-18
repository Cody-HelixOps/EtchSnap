import { mergeSelectionRegions } from './src/lib/selectionMerge.ts'

// Test: Two separate magic wand selections that don't overlap
const region1 = {
  points: [
    { x: 10, y: 10 },
    { x: 30, y: 10 },
    { x: 30, y: 30 },
    { x: 10, y: 30 },
  ],
  closed: true,
}

const region2 = {
  points: [
    { x: 50, y: 10 },
    { x: 70, y: 10 },
    { x: 70, y: 30 },
    { x: 50, y: 30 },
  ],
  closed: true,
}

console.log('Test 1: Shift-clicking two separate areas')
const result1 = mergeSelectionRegions([region1], region2)
console.log('Number of regions after merge:', result1.length)
console.log('Expected: 2 (separate regions should stay separate)')

// Test: Two overlapping magic wand selections
const overlapping1 = {
  points: [
    { x: 10, y: 10 },
    { x: 50, y: 10 },
    { x: 50, y: 40 },
    { x: 10, y: 40 },
  ],
  closed: true,
}

const overlapping2 = {
  points: [
    { x: 30, y: 20 },
    { x: 70, y: 20 },
    { x: 70, y: 50 },
    { x: 30, y: 50 },
  ],
  closed: true,
}

console.log('\nTest 2: Shift-clicking two overlapping areas')
const result2 = mergeSelectionRegions([overlapping1], overlapping2)
console.log('Number of regions after merge:', result2.length)
console.log('Expected: 1 (overlapping regions should merge)')
