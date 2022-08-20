import { useCan } from '../hooks/useCan';

type CanProps = {
  children: React.ReactNode;
  permissions?: string[];
  roles?: string[];
};

export function Can({ children, permissions, roles }: CanProps) {
  const userCanSeeComponent = useCan({ permissions, roles });

  if (!userCanSeeComponent) {
    return null;
  }

  return <>{children}</>;
}
