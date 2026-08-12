import { Extension } from "@tiptap/core";
import { goToNextCell } from "prosemirror-tables";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
  }
}

export interface IndentOptions {
  types: string[];
  min: number;
  max: number;
  stepEm: number;
}

const DEFAULT_OPTIONS: IndentOptions = {
  types: ["paragraph", "heading"],
  min: 0,
  max: 6,
  stepEm: 2,
};

const hasAncestor = ($pos: any, names: string[]): boolean => {
  for (let i = $pos.depth; i > 0; i--) {
    if (names.includes($pos.node(i).type.name)) return true;
  }
  return false;
};

const listTypeOf = ($pos: any): string | null => {
  for (let i = $pos.depth; i > 0; i--) {
    const name = $pos.node(i).type.name;
    if (name === "bulletList" || name === "orderedList") return name;
  }
  return null;
};

export const Indent = Extension.create<IndentOptions>({
  name: "indent",

  addOptions() {
    return { ...DEFAULT_OPTIONS };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) =>
              parseInt(element.getAttribute("data-indent") || "0", 10) || 0,
            renderHTML: (attributes) => {
              const level = Math.max(
                this.options.min,
                Math.min(this.options.max, Number(attributes.indent) || 0),
              );
              if (!level) return {};
              return {
                "data-indent": String(level),
                style: `margin-left: ${level * this.options.stepEm}em;`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    const change = (delta: number) => () => ({ tr, state, dispatch, commands }: any) => {
      const { $from } = state.selection;
      if (hasAncestor($from, ["bulletList", "orderedList", "listItem"])) {
        if (delta > 0) return commands.sinkListItem("listItem");
        if (commands.liftListItem("listItem")) return true;
        const list = listTypeOf($from);
        if (list === "bulletList") return commands.toggleBulletList();
        if (list === "orderedList") return commands.toggleOrderedList();
        return false;
      }
      const node = state.doc.nodeAt($from.before($from.depth));
      if (!node || !this.options.types.includes(node.type.name)) return false;
      const current = Number(node.attrs.indent) || 0;
      const next = Math.max(
        this.options.min,
        Math.min(this.options.max, current + delta),
      );
      if (next === current) return false;
      const setNodeMarkup = tr.setNodeMarkup($from.before($from.depth), undefined, {
        ...node.attrs,
        indent: next,
      });
      if (dispatch) dispatch(tr);
      return true;
    };

    return {
      indent: change(1),
      outdent: change(-1),
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const $from = this.editor.state.selection.$from;
        if (hasAncestor($from, ["table", "tableRow", "tableCell", "tableHeader"])) {
          return (
            this.editor.commands.command(({ state, dispatch }) =>
              goToNextCell(1)(state, dispatch),
            ) || true
          );
        }
        return this.editor.commands.indent() || true;
      },
      "Shift-Tab": () => {
        const $from = this.editor.state.selection.$from;
        if (hasAncestor($from, ["table", "tableRow", "tableCell", "tableHeader"])) {
          return (
            this.editor.commands.command(({ state, dispatch }) =>
              goToNextCell(-1)(state, dispatch),
            ) || true
          );
        }
        return this.editor.commands.outdent() || true;
      },
    };
  },
});
