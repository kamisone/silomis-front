import LogoutButton from "./LogoutButton";
import styles from "./AdminTopBar.module.css";

interface Props {
  onMobileMenuOpen: () => void;
}

export default function AdminTopBar({ onMobileMenuOpen }: Props) {
  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <button type="button" className={styles.hamburger} onClick={onMobileMenuOpen} aria-label="Open menu">
          <span />
          <span />
          <span />
        </button>
      </div>
      <LogoutButton />
    </header>
  );
}
