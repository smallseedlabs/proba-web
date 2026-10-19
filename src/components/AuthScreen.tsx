export function AuthScreen({
  onLogin,
  mockMode,
}: {
  onLogin: () => void;
  mockMode: boolean;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary">Proba</h1>
          <p className="mt-2 text-muted-foreground">
            AI-native platform for testing products with ads
          </p>
        </div>
        <div className="mt-8 space-y-6">
          {mockMode && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3 text-sm">
              <strong>Mock Mode:</strong> Using example fixture data
            </div>
          )}
          <button
            onClick={onLogin}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            {mockMode ? 'Continue with Mock Data' : 'Dev Login'}
          </button>
          <p className="text-xs text-center text-muted-foreground">
            Development authentication stub
          </p>
        </div>
      </div>
    </div>
  );
}
