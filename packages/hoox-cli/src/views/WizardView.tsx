import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { WizardState, GlobalConfig, Config, WorkerConfig } from '../types.js';
import { Card } from '../components/ui/Card.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { Alert } from '../components/ui/Alert.js';
import { Badge } from '../components/ui/Badge.js';
import { theme } from '../components/theme.js';

interface WizardViewProps {
  initialState: WizardState;
  onComplete: (finalState: WizardState) => void;
}

const STEPS = [
  'Dependencies',
  'Globals',
  'Workers',
  'D1Setup',
  'Done'
];

export const WizardView: React.FC<WizardViewProps> = ({ initialState, onComplete }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [globalConfig, setGlobalConfig] = useState<Partial<GlobalConfig>>(
    initialState.config?.global || {}
  );
  
  // Globals form state
  const [activeGlobalField, setActiveGlobalField] = useState(0);
  const globalFields: (keyof GlobalConfig)[] = [
    'cloudflare_api_token',
    'cloudflare_account_id',
    'cloudflare_secret_store_id',
    'subdomain_prefix'
  ];

  const handleGlobalSubmit = (value: string) => {
    if (activeGlobalField < globalFields.length - 1) {
      setActiveGlobalField(activeGlobalField + 1);
    } else {
      setStepIndex(stepIndex + 1);
    }
  };

  const handleGlobalChange = (value: string) => {
    const field = globalFields[activeGlobalField];
    setGlobalConfig(prev => ({ ...prev, [field as string]: value }));
  };

  // Select workers state
  const handleWorkerSelect = (item: any) => {
    // Basic mock for now
    setStepIndex(stepIndex + 1);
  };

  useEffect(() => {
    if (stepIndex === STEPS.length - 1) {
      onComplete({
        ...initialState,
        config: {
          ...initialState.config,
          global: globalConfig as GlobalConfig
        }
      });
    }
  }, [stepIndex]);

  const currentStep = STEPS[stepIndex];

  return (
    <Box flexDirection="column" padding={1} width={80}>
      <Card title="Hoox CLI Setup Wizard" description={`Step ${stepIndex + 1} of ${STEPS.length}: ${currentStep}`}>
        <Box flexDirection="column" marginTop={1}>
          {currentStep === 'Dependencies' && (
            <Box flexDirection="column">
              <Alert title="Checking System Dependencies" variant="default">
                We are checking if bun and wrangler are installed.
              </Alert>
              <Box marginY={1} flexDirection="column">
                <Box><Badge variant="success">OK</Badge><Text> bun found</Text></Box>
                <Box><Badge variant="success">OK</Badge><Text> wrangler found</Text></Box>
              </Box>
              <Select 
                items={[{ label: 'Continue to Global Configuration', value: 'continue' }]} 
                onSelect={() => setStepIndex(stepIndex + 1)} 
              />
            </Box>
          )}

          {currentStep === 'Globals' && (
            <Box flexDirection="column">
              <Alert title="Global Configuration" variant="default">
                Please enter your Cloudflare credentials and global settings.
              </Alert>
              <Box marginY={1} flexDirection="column" gap={1}>
                {globalFields.map((field, idx) => (
                  <Box key={field} flexDirection="column">
                    {idx === activeGlobalField ? (
                      <Input
                        label={field}
                        value={globalConfig[field] || ''}
                        onChange={handleGlobalChange}
                        onSubmit={handleGlobalSubmit}
                        placeholder={`Enter ${field}...`}
                      />
                    ) : (
                      <Box flexDirection="row">
                        <Text color={theme.colors.mutedForeground} dimColor>{field}: </Text>
                        <Text color={theme.colors.foreground}>{idx < activeGlobalField ? (globalConfig[field] || '***') : '---'}</Text>
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {currentStep === 'Workers' && (
            <Box flexDirection="column">
              <Alert title="Worker Selection" variant="default">
                Select which workers you want to deploy and enable.
              </Alert>
              <Box marginY={1}>
                <Select 
                  items={[
                    { label: 'Accept defaults & Continue', value: 'skip' }
                  ]} 
                  onSelect={handleWorkerSelect} 
                />
              </Box>
            </Box>
          )}

          {currentStep === 'D1Setup' && (
            <Box flexDirection="column">
              <Alert title="Database Setup" variant="default">
                Setting up Cloudflare D1 databases.
              </Alert>
              <Box marginY={1}>
                <Select 
                  items={[
                    { label: 'Skip D1 Setup for now', value: 'skip' }
                  ]} 
                  onSelect={() => setStepIndex(stepIndex + 1)} 
                />
              </Box>
            </Box>
          )}

          {currentStep === 'Done' && (
            <Box flexDirection="column">
              <Alert title="Configuration Complete" variant="success">
                Your hoox-cli configuration has been saved successfully!
              </Alert>
            </Box>
          )}
        </Box>
      </Card>
    </Box>
  );
};
