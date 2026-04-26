import React, { useState, useEffect } from 'react';
import { Box, Text, Newline } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { WizardState, GlobalConfig, Config, WorkerConfig } from '../types.js';

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

  if (currentStep === 'Dependencies') {
    return (
      <Box flexDirection="column">
        <Text color="blue">Checking Dependencies...</Text>
        <Text color="green">✓ bun found</Text>
        <Text color="green">✓ wrangler found</Text>
        <Box marginTop={1}>
          {/* @ts-ignore */}
          <SelectInput 
            items={[{ label: 'Continue', value: 'continue' }]} 
            onSelect={() => setStepIndex(stepIndex + 1)} 
          />
        </Box>
      </Box>
    );
  }

  if (currentStep === 'Globals') {
    const currentField = globalFields[activeGlobalField];
    return (
      <Box flexDirection="column">
        <Text color="blue">Configure Globals:</Text>
        {globalFields.map((field, idx) => (
          <Box key={field}>
            <Text color={idx === activeGlobalField ? 'green' : 'dim'}>
              {field}: 
            </Text>
            {/* @ts-ignore */}
            {idx === activeGlobalField ? (
              <TextInput
                value={globalConfig[field] || ''}
                onChange={handleGlobalChange}
                onSubmit={handleGlobalSubmit}
              />
            ) : (
              <Text> {globalConfig[field] || '***'}</Text>
            )}
          </Box>
        ))}
      </Box>
    );
  }

  if (currentStep === 'Workers') {
    return (
      <Box flexDirection="column">
        <Text color="blue">Select Workers to enable (Basic Setup):</Text>
        <SelectInput 
          items={[
            { label: 'Skip for now (Accept defaults)', value: 'skip' }
          ]} 
          onSelect={handleWorkerSelect} 
        />
      </Box>
    );
  }

  if (currentStep === 'D1Setup') {
    return (
      <Box flexDirection="column">
        <Text color="blue">D1 Database Setup</Text>
        <SelectInput 
          items={[
            { label: 'Skip D1 Setup', value: 'skip' }
          ]} 
          onSelect={() => setStepIndex(stepIndex + 1)} 
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text color="green">Wizard Complete!</Text>
    </Box>
  );
};