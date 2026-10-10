-- Розміри модулів моделі на сайті: [{ "w": 3, "l": 6.5 }, …] — для фільтра каталогу «ширина модуля» й показу на сторінці моделі.
-- Застосовано через MCP 10.10.2026.
alter table public.site_models add column if not exists module_dims jsonb default '[]'::jsonb;
comment on column public.site_models.module_dims is 'Модулі моделі: масив {w, l} у метрах (ширина × довжина кожного модуля)';

-- початкові значення — з моделей каталогу, до яких привʼязані моделі сайту
update public.site_models s set module_dims = t.modules
from public.product_templates t
where t.id = s.template_id and jsonb_typeof(t.modules) = 'array' and jsonb_array_length(t.modules) > 0
  and (s.module_dims is null or s.module_dims = '[]'::jsonb);

-- НЕ застосовано (потрібне підтвердження власника): щоб module_dims оновлювались самі разом з іншими параметрами
-- з каталогу, треба дописати в site_model_params_from_template() і template_params_to_site() рядок про t.modules / new.modules
-- та додати стовпчик modules у тригер product_templates_to_site. Поки розміри модулів на сайті редагуються в картці моделі сайту.
