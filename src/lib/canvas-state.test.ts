import { describe, it, expect } from 'vitest'
import {
  addNode, removeNode, updateNode, moveNode,
  bringToFront, sendToBack, nextZIndex,
  createUndoRedoManager,
} from './canvas-state'
import { CanvasNode, CanvasState, createEmptyState } from './canvas-types'

const makeShape = (id: string, x = 0, y = 0): CanvasNode => ({
  id, type: 'shape', x, y, width: 100, height: 100, zIndex: 0,
  data: { shapeType: 'rectangle', label: 'test' },
})

describe('addNode', () => {
  it('adds a node to empty state', () => {
    const state = createEmptyState()
    const node = makeShape('s1')
    const next = addNode(state, node)
    expect(next.nodes).toHaveLength(1)
    expect(next.nodes[0].id).toBe('s1')
  })
  it('assigns next zIndex automatically', () => {
    let state = createEmptyState()
    state = addNode(state, makeShape('s1'))
    state = addNode(state, makeShape('s2'))
    expect(state.nodes[1].zIndex).toBe(1)
  })
})

describe('removeNode', () => {
  it('removes a node by id', () => {
    let state = createEmptyState()
    state = addNode(state, makeShape('s1'))
    state = addNode(state, makeShape('s2'))
    state = removeNode(state, 's1')
    expect(state.nodes).toHaveLength(1)
    expect(state.nodes[0].id).toBe('s2')
  })
  it('returns same state if id not found', () => {
    const state = addNode(createEmptyState(), makeShape('s1'))
    const next = removeNode(state, 'nonexistent')
    expect(next).toBe(state)
  })
})

describe('updateNode', () => {
  it('updates node properties', () => {
    let state = addNode(createEmptyState(), makeShape('s1', 0, 0))
    state = updateNode(state, 's1', { x: 50, y: 100 })
    expect(state.nodes[0].x).toBe(50)
    expect(state.nodes[0].y).toBe(100)
  })
})

describe('moveNode', () => {
  it('updates x and y', () => {
    let state = addNode(createEmptyState(), makeShape('s1', 10, 20))
    state = moveNode(state, 's1', 50, 60)
    expect(state.nodes[0].x).toBe(50)
    expect(state.nodes[0].y).toBe(60)
  })
})

describe('bringToFront / sendToBack', () => {
  it('bringToFront sets highest zIndex', () => {
    let state = createEmptyState()
    state = addNode(state, makeShape('s1'))
    state = addNode(state, makeShape('s2'))
    state = addNode(state, makeShape('s3'))
    state = bringToFront(state, 's1')
    const node = state.nodes.find(n => n.id === 's1')!
    expect(node.zIndex).toBe(3)
  })
  it('sendToBack sets zIndex 0 and shifts others up', () => {
    let state = createEmptyState()
    state = addNode(state, makeShape('s1'))
    state = addNode(state, makeShape('s2'))
    state = addNode(state, makeShape('s3'))
    state = sendToBack(state, 's3')
    const node = state.nodes.find(n => n.id === 's3')!
    expect(node.zIndex).toBe(0)
  })
})

describe('undo/redo', () => {
  it('undo reverts to previous state', () => {
    const mgr = createUndoRedoManager()
    const s1 = addNode(createEmptyState(), makeShape('s1'))
    mgr.push(s1)
    const s2 = addNode(s1, makeShape('s2'))
    mgr.push(s2)
    const undone = mgr.undo()
    expect(undone?.nodes).toHaveLength(1)
  })
  it('redo restores undone state', () => {
    const mgr = createUndoRedoManager()
    const s1 = addNode(createEmptyState(), makeShape('s1'))
    mgr.push(s1)
    const s2 = addNode(s1, makeShape('s2'))
    mgr.push(s2)
    mgr.undo()
    const redone = mgr.redo()
    expect(redone?.nodes).toHaveLength(2)
  })
  it('push after undo clears redo stack', () => {
    const mgr = createUndoRedoManager()
    mgr.push(addNode(createEmptyState(), makeShape('s1')))
    mgr.push(addNode(createEmptyState(), makeShape('s2')))
    mgr.undo()
    mgr.push(addNode(createEmptyState(), makeShape('s3')))
    expect(mgr.redo()).toBeNull()
  })
  it('respects max history size', () => {
    const mgr = createUndoRedoManager(3)
    for (let i = 0; i < 5; i++) {
      mgr.push(addNode(createEmptyState(), makeShape(`s${i}`)))
    }
    let count = 0
    while (mgr.undo()) count++
    expect(count).toBe(2)
  })
})
