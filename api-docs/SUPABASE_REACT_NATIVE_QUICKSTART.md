# React Native + Supabase

Короткий общий гайд по подключению React Native / Expo к Supabase и работе с запросами.

## 1. Установка

Для Expo:

```bash
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage
```

## 2. Переменные окружения

Создайте `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://kavlgpfxxvicqhzcgspa.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_3SOVmNqjiszNTrrpLnX6Jw_AaY0VQ9K
```

`Publishable key` можно использовать в мобильном приложении.

Никогда не кладите на фронт:

```text
service_role
secret key
database password
любые приватные API-ключи
```

## 3. Создание Supabase client

Создайте один общий файл, например `src/lib/supabase.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

export const supabase = createClient<Database>(url, key, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```

После этого в любом файле:

```ts
import { supabase } from '@/lib/supabase'
```

Не создавайте новый `createClient()` в каждом компоненте.

## 4. Авторизация

Регистрация:

```ts
const { data, error } = await supabase.auth.signUp({
  email,
  password,
})
```

Вход:

```ts
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
})
```

Текущий пользователь:

```ts
const {
  data: { user },
} = await supabase.auth.getUser()
```

Текущая сессия:

```ts
const {
  data: { session },
} = await supabase.auth.getSession()
```

Выход:

```ts
await supabase.auth.signOut()
```

Supabase SDK сам хранит сессию и прикладывает JWT авторизованного пользователя к запросам.

## 5. Запросы к базе

Основной синтаксис:

```ts
supabase.from('table_name')
```

SELECT:

```ts
const { data, error } = await supabase
  .from('table_name')
  .select('*')
```

Лучше запрашивать только нужные поля:

```ts
const { data, error } = await supabase
  .from('table_name')
  .select('id, name, created_at')
```

Одна запись:

```ts
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('id', id)
  .single()
```

INSERT:

```ts
const { data, error } = await supabase
  .from('table_name')
  .insert(payload)
  .select()
  .single()
```

UPDATE:

```ts
const { data, error } = await supabase
  .from('table_name')
  .update(payload)
  .eq('id', id)
  .select()
  .single()
```

DELETE:

```ts
const { error } = await supabase
  .from('table_name')
  .delete()
  .eq('id', id)
```

Для `UPDATE` и `DELETE` внимательно проверяйте фильтр.

## 6. Фильтры и сортировка

```ts
.eq('status', 'active')
.neq('status', 'deleted')
.gt('value', 10)
.gte('value', 10)
.lt('value', 100)
.lte('value', 100)
.in('status', ['active', 'pending'])
```

Можно комбинировать:

```ts
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(20)
```

## 7. Связанные таблицы

Если в БД настроены foreign keys:

```ts
const { data, error } = await supabase
  .from('table_name')
  .select(`
    id,
    name,
    related_table (
      id,
      name
    )
  `)
```

Supabase строит Data API поверх связей PostgreSQL.

## 8. Ошибки

Почти любой запрос возвращает:

```ts
{
  data,
  error
}
```

Обычно API-функция выглядит так:

```ts
export async function getItems() {
  const { data, error } = await supabase
    .from('table_name')
    .select('*')

  if (error) throw error

  return data
}
```

Рекомендуемая структура:

```text
src/
├── lib/
│   └── supabase.ts
├── api/
│   ├── auth.ts
│   └── ...
└── types/
    └── database.types.ts
```

## 9. RLS

Доступ к данным контролируется Supabase Row Level Security.

Поэтому корректный запрос может вернуть пустой массив, ничего не обновить или вернуть `permission denied`, если текущему пользователю действие запрещено.

Никогда не решайте проблемы RLS добавлением `service_role` на фронт.

## 10. Storage

Загрузка:

```ts
const { data, error } = await supabase.storage
  .from('bucket-name')
  .upload(path, fileData, {
    contentType: 'image/jpeg',
  })
```

Публичный URL:

```ts
const { data } = supabase.storage
  .from('bucket-name')
  .getPublicUrl(path)
```

Signed URL для приватного bucket:

```ts
const { data, error } = await supabase.storage
  .from('bucket-name')
  .createSignedUrl(path, 60 * 10)
```

В React Native файл удобно преобразовать в `ArrayBuffer`:

```ts
const arrayBuffer = await fetch(fileUri)
  .then(res => res.arrayBuffer())
```

## 11. Edge Functions

```ts
const { data, error } = await supabase.functions.invoke(
  'function-name',
  {
    body: payload,
  }
)
```

Edge Functions нужны для серверной логики, секретов и приватных сторонних API-ключей.

## 12. Зачем нужен `database.types.ts`

Это TypeScript-описание реальной схемы Supabase.

React Native здесь ничем не отличается от любого TypeScript-проекта: файл используется во время разработки и сборки.

С ним TypeScript ловит ошибки вроде:

```ts
supabase.from('psots')
```

или:

```ts
supabase
  .from('posts')
  .insert({
    field_that_does_not_exist: 123,
  })
```

Также появляются:

- autocomplete таблиц;
- autocomplete полей;
- типы `Row`;
- типы для `Insert`;
- типы для `Update`;
- информация о relationships.

Пример:

```ts
import type {
  Tables,
  TablesInsert,
  TablesUpdate,
} from '@/types/database.types'

type Post = Tables<'posts'>
type NewPost = TablesInsert<'posts'>
type PostUpdate = TablesUpdate<'posts'>
```

`database.types.ts` не содержит секретов, его можно хранить в Git.

После изменения schema его нужно генерировать заново.

## 13. Главное

Фронту нужны:

```text
SUPABASE URL
PUBLISHABLE KEY
database.types.ts
```

Дальше работа идёт через:

```ts
supabase.auth
supabase.from(...)
supabase.storage
supabase.functions
```

Официальная документация:

- https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native
- https://supabase.com/docs/reference/javascript/introduction
