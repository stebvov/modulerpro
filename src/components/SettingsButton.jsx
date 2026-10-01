// Єдина кнопка налаштувань системи: квадратна, з шестернею. Що саме налаштовує — у підказці (title).
import { GearIcon } from "@/components/Icon";

export default function SettingsButton({ title = "Налаштування", active = false, className = "", ...rest }) {
  return (
    <button type="button" className={`btn icon-btn-sq settings-btn${active ? " active" : ""}${className ? " " + className : ""}`} title={title} aria-label={title} {...rest}>
      <GearIcon />
    </button>
  );
}
