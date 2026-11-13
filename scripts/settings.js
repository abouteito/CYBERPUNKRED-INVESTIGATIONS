import { MODULE_ID } from "./constants.js";

const rerender = () => {
  for (const app of foundry.applications.instances.values()) {
    if (app.options?.classes?.includes("cprinv")) app.render();
  }
  for (const app of Object.values(ui.windows)) {
    if (app.actor) app.render(false);
  }
};

export function registerSettings() {
  game.settings.register(MODULE_ID, "showDv", {
    name: "CPRINV.Settings.ShowDv.Name",
    hint: "CPRINV.Settings.ShowDv.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: rerender,
  });
  game.settings.register(MODULE_ID, "complexityDisplay", {
    name: "CPRINV.Settings.ComplexityDisplay.Name",
    hint: "CPRINV.Settings.ComplexityDisplay.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      number: "CPRINV.Settings.ComplexityDisplay.Number",
      bar: "CPRINV.Settings.ComplexityDisplay.Bar",
      hidden: "CPRINV.Settings.ComplexityDisplay.Hidden",
    },
    default: "bar",
    onChange: rerender,
  });
  game.settings.register(MODULE_ID, "tiesSucceed", {
    name: "CPRINV.Settings.TiesSucceed.Name",
    hint: "CPRINV.Settings.TiesSucceed.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });
  game.settings.register(MODULE_ID, "mookFocus", {
    name: "CPRINV.Settings.MookFocus.Name",
    hint: "CPRINV.Settings.MookFocus.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: rerender,
  });
  game.settings.register(MODULE_ID, "useWorldTime", {
    name: "CPRINV.Settings.UseWorldTime.Name",
    hint: "CPRINV.Settings.UseWorldTime.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: rerender,
  });
  game.settings.register(MODULE_ID, "dayOffset", {
    scope: "world",
    config: false,
    type: Number,
    default: 0,
    onChange: rerender,
  });
}

export const getSetting = (key) => game.settings.get(MODULE_ID, key);
