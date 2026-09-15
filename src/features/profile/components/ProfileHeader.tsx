
import { AppHeader } from '@/components/AppHeader';
import { useAuth } from '@/services/auth';

/**
 * Шапка вкладки «Профиль» — общий `AppHeader`: колокольчик (уведомления) слева,
 * шестерёнка (настройки) справа.
 */
export function ProfileHeader() {
  const { signOut } = useAuth();

  return (
    <AppHeader
      title="Моя страница"
      actions={[
        // TODO: заменить на переход в экран настроек; выход — временно здесь.
        { icon: 'logout', onPress: signOut, accessibilityLabel: 'Выйти из аккаунта' },
      ]}
    />
  );
}
