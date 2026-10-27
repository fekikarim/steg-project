import Image from 'next/image';
import {getTranslations} from 'next-intl/server';
import {HeaderClient} from './HeaderClient';

/** Server shell: translated nav labels; interactivity lives in HeaderClient. */
export async function Header() {
  const t = await getTranslations('nav');
  const th = await getTranslations('header');
  return (
    <HeaderClient
      labels={{
        home: t('home'),
        about: t('about'),
        history: t('history'),
        internships: t('internships'),
        companion: t('companion'),
        apply: t('apply'),
        signIn: t('signIn'),
        createAccount: t('createAccount'),
        profile: t('profile'),
        applications: t('applications'),
        documents: t('documents'),
        notifications: t('notifications'),
        signOut: t('signOut'),
        skipToContent: th('skipToContent'),
        openMenu: th('openMenu'),
        closeMenu: th('closeMenu'),
        nationalBadge: th('nationalBadge'),
        candidateSpace: th('candidateSpace'),
        primaryNav: th('primaryNav'),
        mobileNav: th('mobileNav'),
      }}
      logo={
        <Image
          src="/logo/logo-steg-1200x327.png"
          alt="STEG"
          width={1200}
          height={327}
          priority
          sizes="132px"
          className="h-9 w-auto"
        />
      }
    />
  );
}
