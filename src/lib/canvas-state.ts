import { CanvasNode, CanvasState } from './canvas-types'

export function nextZIndex(state: CanvasState): number {
  if (state.nodes.length === 0) return 0
  return Math.max(...state.nodes.map(n => n.zIndex)) + 1
}

export function addNode(state: CanvasState, node: CanvasNode): CanvasState {
  const withZ = { ...node, zIndex: nextZIndex(state) }
  return { ...state, nodes: [...state.nodes, withZ] }
}

export function removeNode(state: CanvasState, id: string): CanvasState {
  const filtered = state.nodes.filter(n => n.id !== id)
  if (filtered.length === state.nodes.length) return state
  return { ...state, nodes: filtered }
}

export function updateNode(state: CanvasState, id: string, updates: Partial<CanvasNode>): CanvasState {
  return {
    ...state,
    nodes: state.nodes.map(n => n.id === id ? { ...n, ...updates } : n),
  }
}

export function moveNode(state: CanvasState, id: string, x: number, y: number): CanvasState {
  return updateNode(state, id, { x, y })
}

export function bringToFront(state: CanvasState, id: string): CanvasState {
  return updateNode(state, id, { zIndex: nextZIndex(state) })
}

export function sendToBack(state: CanvasState, id: string): CanvasState {
  const node = state.nodes.find(n => n.id === id)
  if (!node) return state
  return {
    ...state,
    nodes: state.nodes.map(n => {
      if (n.id === id) return { ...n, zIndex: 0 }
      if (n.zIndex < node.zIndex) return { ...n, zIndex: n.zIndex + 1 }
      return n
    }),
  }
}

export type UndoRedoManager = {
  push: (state: CanvasState) => void
  undo: () => CanvasState | null
  redo: () => CanvasState | null
}

export function createUndoRedoManager(maxSize = 50): UndoRedoManager {
  const past: CanvasState[] = []
  const future: CanvasState[] = []

  return {
    push(state: CanvasState) {
      past.push(state)
      future.length = 0
      if (past.length > maxSize) past.shift()
    },
    undo(): CanvasState | null {
      if (past.length <= 1) return null
      const current = past.pop()!
      future.push(current)
      return past[past.length - 1]
    },
    redo(): CanvasState | null {
      if (future.length === 0) return null
      const state = future.pop()!
      past.push(state)
      return state
    },
  }
}
