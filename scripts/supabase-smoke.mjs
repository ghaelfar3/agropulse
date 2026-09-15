// Смоук-проверка бэкенда без сборки приложения.
//   npm run smoke                                       — только анонимные проверки
//   SMOKE_EMAIL=... SMOKE_PASSWORD=... npm run smoke     — вход и данные под пользователем
//   SMOKE_EMAIL=... SMOKE_PASSWORD=... SMOKE_SIGNUP=1 npm run smoke
//                                                        — регистрация нового аккаунта
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const envPath = new URL('../.env', import.meta.url);

const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);

const supabase = createClient(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const ok = (m) => console.log(`  ok   ${m}`);
const bad = (m, e) => console.log(`  FAIL ${m} — ${e?.message ?? e}`);

console.log('\n1. Справочники (анонимно)');
for (const table of ['post_types', 'post_stages', 'post_statuses', 'reaction_types', 'crops']) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) bad(table, error);
  else ok(`${table}: ${data.length} строк${data.length === 0 ? ' (пусто)' : ''}`);
}

const email = process.env.SMOKE_EMAIL;

if (process.env.SMOKE_SIGNUP && email) {
  console.log('\n2. Регистрация (последний шаг мастера)');
  const { data, error } = await supabase.auth.signUp({ email, password: process.env.SMOKE_PASSWORD });
  if (error) bad('signUp', error);
  else if (!data.session) bad('signUp', 'сессия не вернулась — подтверждение почты снова включено?');
  else {
    ok(`аккаунт создан и сразу авторизован, user.id=${data.user.id}`);
    const { data: prof, error: prErr } = await supabase
      .from('profiles')
      .update({ name: 'Смоук Тест', specialization: 'Растениеводство', region: 'Тестовый край' })
      .eq('id', data.user.id)
      .select()
      .single();
    prErr ? bad('profiles.update', prErr) : ok(`профиль заполнен: ${prof.name} / ${prof.specialization}`);
  }
}

if (email && process.env.SMOKE_PASSWORD && !process.env.SMOKE_SIGNUP) {
  console.log('\n2. Вход по паролю');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: process.env.SMOKE_PASSWORD });
  if (error) { bad('signInWithPassword', error); process.exit(1); }
  ok(`вошли, user.id=${data.user.id}`);

  console.log('\n3. Данные под пользователем');
  const { data: prof, error: prErr } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
  prErr ? bad('profiles', prErr) : ok(`профиль: ${prof ? `${prof.name ?? '(без имени)'}, репутация ${prof.reputation}` : 'СТРОКИ НЕТ — триггер не сработал'}`);

  const { data: fields, error: fErr } = await supabase.from('fields').select('id, name, region, created_at, updated_at, owner_id');
  fErr ? bad('fields (без геометрии)', fErr) : ok(`fields: ${fields.length}`);

  const created = await supabase.from('fields')
    .insert({ owner_id: data.user.id, name: 'Смоук-поле', center: 'POINT(24.1052 56.9496)' })
    .select('id, name').single();
  if (created.error) bad('создание поля с WKT-точкой', created.error);
  else {
    ok(`поле создано: ${created.data.id}`);
    const geo = await supabase.from('fields').select('center').eq('id', created.data.id).single();
    console.log(`  инфо  так PostgREST отдаёт center: ${JSON.stringify(geo.data?.center)?.slice(0, 60)}`);
    await supabase.from('fields').delete().eq('id', created.data.id);
    ok('поле удалено');
  }

  const { data: feed, error: feedErr } = await supabase.from('posts').select(`
    id, title, body, created_at, field_id,
    profiles!posts_author_id_fkey ( id, name, specialization, region, avatar_path, reputation ),
    crops ( id, slug, name ), post_types ( code, name ), post_stages ( code, name ),
    post_statuses ( code, name ), post_media ( id, media_type, storage_path, sort_order )
  `).order('created_at', { ascending: false }).limit(5);
  feedErr ? bad('лента с join-ами', feedErr) : ok(`лента: ${feed.length} постов, форма join-ов корректна`);

  const { error: bErr } = await supabase.storage.from('avatars').list(data.user.id);
  bErr ? bad('bucket avatars', bErr) : ok('bucket avatars доступен');
}

console.log('');
