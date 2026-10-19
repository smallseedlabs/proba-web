import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthError, type AuthClient, type Session } from '../../lib/auth';
import { SignInPage } from './SignInPage';

const session: Session = { token: 't', user: { id: 'u', email: 'ana@acme.com', name: 'Ana' }, workspaces: [{ id: 'w', name: 'Acme' }] };

function setup(signIn: AuthClient['signIn']) {
  const auth: AuthClient = { signIn, signOut: vi.fn() };
  const onSignedIn = vi.fn();
  render(<SignInPage auth={auth} onSignedIn={onSignedIn} />);
  return { onSignedIn, signIn };
}

describe('SignInPage', () => {
  it('shows a branded sign-in form with no development wording', () => {
    setup(vi.fn());
    expect(screen.getByRole('heading', { name: 'Sign in to Proba' })).toBeInTheDocument();
    expect(screen.getByLabelText('Work email')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(document.body.textContent).not.toMatch(/mock|dev login|fixture|test data|beta|alpha/i);
  });

  it('validates the fields before contacting the Hub', async () => {
    const { signIn } = setup(vi.fn());
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter your work email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Work email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Work email')).toHaveFocus();

    await userEvent.type(screen.getByLabelText('Work email'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText(/Enter a valid email address/)).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('shows a loading state and completes sign-in', async () => {
    let resolve: (s: Session) => void = () => {};
    const { onSignedIn } = setup(vi.fn(() => new Promise<Session>((r) => (resolve = r))));
    await userEvent.type(screen.getByLabelText('Work email'), 'ana@acme.com');
    await userEvent.type(screen.getByLabelText('Password'), 'long-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    const button = screen.getByRole('button', { name: 'Signing in…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('Work email')).toBeDisabled();

    resolve(session);
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(session));
  });

  it('announces sign-in errors from the auth client', async () => {
    setup(vi.fn().mockRejectedValue(new AuthError('invalid_credentials')));
    await userEvent.type(screen.getByLabelText('Work email'), 'ana@acme.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The email or password you entered is incorrect.');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('toggles password visibility', async () => {
    setup(vi.fn());
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  });
});
