/**
 * The rows that edit a section's conditions: a property, an operator that
 * means something for that property's type, and a value when the operator
 * takes one. Each row's description reads the condition back in words.
 */

import { Setting } from "obsidian";
import { describeCondition, opsFor } from "../compose/conditions";
import { CONDITION_OPS, FILE_FIELDS, LIMITS, type Condition, type ValueType } from "../settings/schema";

export function renderConditionList(
  el: HTMLElement,
  conditions: Condition[],
  /** Vault property keys with their inferred types. */
  types: ReadonlyMap<string, ValueType>,
  changed: () => void,
  redraw: () => void
): void {
  const typeOf = (field: string): ValueType =>
    FILE_FIELDS.find((f) => f.id === field)?.type ?? types.get(field) ?? "text";

  conditions.forEach((cond, i) => {
    const row = new Setting(el).setName(i === 0 ? "Where" : "And");
    const ops = opsFor(typeOf(cond.property));
    // An operator from another type falls back to this type's first.
    if (!ops.some((op) => op.id === cond.op)) cond.op = ops[0].id;
    const op = CONDITION_OPS.find((o) => o.id === cond.op);
    // The controls read as a sentence; the description adds only what they cannot say.
    row.setDesc(!cond.property.trim() ? "Choose a property." : op?.input === "days" ? "In days, counting today." : "");
    row.settingEl.setAttr("aria-label", describeCondition(cond));

    row.addDropdown((d) => {
      d.addOption("", "Property");
      for (const f of FILE_FIELDS) d.addOption(f.id, f.label);
      for (const key of types.keys()) d.addOption(key, key);
      if (cond.property && !FILE_FIELDS.some((f) => f.id === cond.property) && !types.has(cond.property)) {
        d.addOption(cond.property, `${cond.property} (not in vault)`);
      }
      d.setValue(cond.property).onChange((v) => {
        cond.property = v;
        changed();
        redraw();
      });
    });
    row.addDropdown((d) => {
      for (const o of ops) d.addOption(o.id, o.label);
      d.setValue(cond.op).onChange((v) => {
        const next = CONDITION_OPS.find((o) => o.id === v);
        if (!next) return;
        cond.op = next.id;
        if (next.input === "none") cond.value = "";
        changed();
        redraw();
      });
    });
    if (op && op.input !== "none") {
      row.addText((t) =>
        t
          .setPlaceholder(op.input === "days" ? "Days" : op.input === "number" ? "Number" : "Value")
          .setValue(cond.value)
          .onChange((v) => {
            cond.value = v;
            row.settingEl.setAttr("aria-label", describeCondition(cond));
            changed();
          })
      );
    }
    row.addExtraButton((b) =>
      b.setIcon("trash").setTooltip("Remove condition").onClick(() => {
        conditions.splice(i, 1);
        changed();
        redraw();
      })
    );
  });

  if (conditions.length < LIMITS.conditions.max) {
    new Setting(el).addButton((b) =>
      b.setButtonText("Add condition").onClick(() => {
        conditions.push({ property: "", op: "is", value: "" });
        changed();
        redraw();
      })
    );
  }
}
