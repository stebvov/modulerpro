-- Каталог моделей: собівартість або з BOM, або «за прайсом» (fixed_cost), ціна клієнту = собівартість × (1 + націнка) ÷ (1 − податок).
-- base_cost_per_m2 — це ЦІНА клієнту за м² (так її й використовує CRM в угодах); при націнці 0 і податку 0 усе рахується, як раніше.

alter table public.product_templates add column if not exists cost_note text;       -- звідки собівартість (напр. «Прайс 14.09.2026, курс 44,55»)

create or replace view public.template_cost_calculated as
select t.id as template_id,
    t.name,
    t.area_m2,
    x.total_cost,
    round(x.total_cost / nullif(t.area_m2, 0::numeric), 2) as cost_per_m2,
    case when t.cost_mode = 'fixed' then false else coalesce(bom_sum.has_stale, false) end as has_stale_price,
    case when t.cost_mode = 'fixed' then t.fixed_cost is null else coalesce(bom_sum.has_missing, false) end as has_missing_price,
    t.cost_mode,
    round(x.total_cost * (1 + t.markup_percent / 100) / nullif(1 - t.tax_percent / 100, 0::numeric), 2) as price_total,
    round(x.total_cost * (1 + t.markup_percent / 100) / nullif(1 - t.tax_percent / 100, 0::numeric) / nullif(t.area_m2, 0::numeric), 2) as price_per_m2
   from product_templates t
     left join ( select bi.template_id,
            sum(bi.quantity_per_unit * coalesce(bi.unit_price_override, mbp.price)) as total,
            bool_or(bi.unit_price_override is null and mbp.is_stale) as has_stale,
            bool_or(coalesce(bi.unit_price_override, mbp.price) is null) as has_missing
           from template_bom_items bi
             left join material_best_price mbp on mbp.material_id = bi.material_id
          group by bi.template_id) bom_sum on bom_sum.template_id = t.id
     left join ( select template_extra_costs.template_id,
            sum(template_extra_costs.amount) as total
           from template_extra_costs
          group by template_extra_costs.template_id) extra_sum on extra_sum.template_id = t.id
     cross join lateral ( select case when t.cost_mode = 'fixed' then coalesce(t.fixed_cost, 0::numeric)
            else coalesce(bom_sum.total, 0::numeric) + coalesce(extra_sum.total, 0::numeric) end as total_cost) x;

create or replace function public.recalc_template_cost(p_template_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update product_templates t
  set base_cost_per_m2 = nullif(tc.price_per_m2, 0), updated_at = now()
  from template_cost_calculated tc
  where tc.template_id = t.id and t.id = p_template_id;
end;
$$;

-- зміна способу розрахунку, суми, націнки, податку чи площі — одразу перерахунок ціни
create or replace function public.trg_recalc_template_on_pricing_change() returns trigger
language plpgsql as $$
begin
  perform recalc_template_cost(new.id);
  return null;
end;
$$;
create or replace trigger recalc_cost_after_pricing_change
  after insert or update of cost_mode, fixed_cost, markup_percent, tax_percent, area_m2 on public.product_templates
  for each row execute function public.trg_recalc_template_on_pricing_change();
