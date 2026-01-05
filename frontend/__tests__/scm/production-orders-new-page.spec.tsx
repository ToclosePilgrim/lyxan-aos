/**
 * Regression test for /scm/production-orders/new page
 * 
 * This test ensures that the page renders without runtime errors,
 * specifically catching issues like "Select.Item must have a value prop that is not an empty string"
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import NewProductionOrderPage from '@/app/(protected)/scm/production-orders/new/page';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

// Mock API requests
jest.mock('@/lib/api', () => ({
  apiRequest: jest.fn(),
}));

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Production Orders New Page', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Spy on console.error to catch runtime errors
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock router
    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    });

    // Mock API to return empty arrays initially
    const { apiRequest } = require('@/lib/api');
    apiRequest.mockResolvedValue([]);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('renders Create Production Order page without runtime errors', async () => {
    // This test will fail if there are runtime errors during render,
    // such as "Select.Item must have a value prop that is not an empty string"
    expect(() => {
      render(<NewProductionOrderPage />);
    }).not.toThrow();

    // Wait a bit for any async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check that console.error was not called with Select.Item errors
    const errorCalls = consoleErrorSpy.mock.calls;
    const selectItemErrors = errorCalls.filter((call) => {
      const errorMessage = call[0]?.toString() || '';
      return (
        errorMessage.includes('Select.Item') ||
        errorMessage.includes('must have a value prop') ||
        errorMessage.includes('Select.Item /> must have a value prop')
      );
    });

    expect(selectItemErrors).toHaveLength(0);

    // Basic sanity check: verify the page title is rendered
    expect(
      screen.getByText(/Create Production Order/i)
    ).toBeInTheDocument();
  });

  it('renders form fields without SelectItem value errors', async () => {
    render(<NewProductionOrderPage />);

    // Wait for loading to complete (component sets loading to false after API calls)
    // Since we mocked API to return empty arrays, loading should complete quickly
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify that Select components are rendered (they should not throw)
    // The page should render without errors even with empty data
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Select.Item'),
      expect.anything()
    );
  });

  it('handles SelectItem with proper values when data is loaded', async () => {
    const { apiRequest } = require('@/lib/api');

    // Mock API to return sample data
    apiRequest
      .mockResolvedValueOnce([
        { id: '1', internalName: 'Test Product', sku: 'SKU-001' },
      ])
      .mockResolvedValueOnce([
        { id: '1', name: 'Test Country', code: 'TC' },
      ])
      .mockResolvedValueOnce([
        { id: '1', name: 'Test Manufacturer', code: 'TM', country: null },
      ]);

    render(<NewProductionOrderPage />);

    // Wait for data to load and component to re-render
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Verify no SelectItem errors occurred
    const errorCalls = consoleErrorSpy.mock.calls;
    const selectItemErrors = errorCalls.filter((call) => {
      const errorMessage = call[0]?.toString() || '';
      return (
        errorMessage.includes('Select.Item') ||
        errorMessage.includes('must have a value prop') ||
        errorMessage.includes('Select.Item /> must have a value prop')
      );
    });

    expect(selectItemErrors).toHaveLength(0);
  });
});

