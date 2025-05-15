import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

// Import assets from the correct path
import styleCss from '../assets/dist/index.css';
import indexHtml from '../assets/dist/index.html';
import indexJs from '../assets/dist/index.js';

const StaticTest = () => {
  const [localHtmlUri, setLocalHtmlUri] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const copyHtmlToFileSystem = async () => {
      try {
        setIsLoading(true);
        console.log('Starting to copy files to the filesystem...');

        // Create a mapping of assets to copy
        const assetsToCopy = {
          'index.html': indexHtml,
          'index.css': styleCss,
          //'index.js': indexJs,
        };

        // Create the dist directory if it doesn't exist
        const distFolderUri = FileSystem.documentDirectory + 'dist/';
        const folderInfo = await FileSystem.getInfoAsync(distFolderUri);

        if (!folderInfo.exists) {
          await FileSystem.makeDirectoryAsync(distFolderUri, { intermediates: true });
          console.log(`Created dist folder at ${distFolderUri}`);
        }

        // Copy each asset to the filesystem
        const copyPromises = Object.entries(assetsToCopy).map(async ([filename, module]) => {
          try {
            // Load and resolve the asset
            const asset = Asset.fromModule(module);
            await asset.downloadAsync();

            // Target location in the device file system
            const targetPath = distFolderUri + filename;

            // Log information for debugging
            console.log(`Asset ${filename} localUri:`, asset.localUri);
            console.log(`Target path for ${filename}:`, targetPath);

            // Copy file to local FS
            await FileSystem.copyAsync({
              from: asset.localUri || '',
              to: targetPath,
            });

            // Verify file was copied
            const fileInfo = await FileSystem.getInfoAsync(targetPath);
            if (fileInfo.exists) {
              console.log(`${filename} copied successfully to:`, targetPath);

              // Read HTML content for preview if it's the HTML file
              if (filename === 'index.html') {
                const content = await FileSystem.readAsStringAsync(targetPath);
                setHtmlContent(content);
                console.log('HTML content length:', content.length);

                // Make sure the URI is properly formatted for WebView
                const formattedUri = targetPath.startsWith('file://') ? targetPath : 'file://' + targetPath;
                setLocalHtmlUri(formattedUri);
              }
            } else {
              console.error(`Failed to copy ${filename}. File doesn't exist at target location.`);
            }
          } catch (err) {
            console.error(`Error copying ${filename}:`, err);
            throw err;
          }
        });

        // Wait for all copy operations to complete
        await Promise.all(copyPromises);
        console.log('All files copied successfully!');
      } catch (err: any) {
        console.error('Error in copyHtmlToFileSystem:', err);
        setError(err.message || 'Unknown error occurred during file copy');
      } finally {
        setIsLoading(false);
      }
    };

    copyHtmlToFileSystem();
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <Button
          title="Retry"
          onPress={() => {
            setError('');
            setIsLoading(true);
            // In React Native, we can't use window.location.reload
            // Instead, we'll trigger the useEffect again by changing state
            setLocalHtmlUri(null);
          }}
        />
      </View>
    );
  }

  if (isLoading || !localHtmlUri) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading files...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>Static WebView Test</Text>

      <Button title={showDebug ? 'Hide Debug Info' : 'Show Debug Info'} onPress={() => setShowDebug(!showDebug)} />

      {showDebug && (
        <View style={styles.debugContainer}>
          <ScrollView style={styles.debugScroll}>
            <Text style={styles.debugText}>URI: {localHtmlUri}</Text>
            <Text style={styles.debugText}>Content Length: {htmlContent.length} bytes</Text>
            <Text style={styles.debugText}>Content Preview:</Text>
            <Text style={styles.debugContent}>{htmlContent}</Text>
          </ScrollView>
        </View>
      )}

      <View style={styles.webViewContainer}>
        <WebView
          originWhitelist={['*']}
          source={{ uri: localHtmlUri }}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          onError={(event) => {
            console.error('WebView error:', event.nativeEvent);
            setError(`WebView error: ${event.nativeEvent.description}`);
          }}
          onLoad={() => console.log('WebView loaded')}
          onHttpError={(event) => {
            console.error('WebView HTTP error:', event.nativeEvent);
          }}
          renderLoading={() => (
            <View style={styles.center}>
              <ActivityIndicator size="large" />
              <Text>Loading content...</Text>
            </View>
          )}
          startInLoadingState={true}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  headerText: {
    marginVertical: 10,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
  webViewContainer: {
    flex: 1,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
  },
  webView: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 20,
  },
  loadingText: {
    marginTop: 10,
  },
  debugContainer: {
    maxHeight: 200, // Limit the height to make scrolling necessary
    marginVertical: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  debugScroll: {
    backgroundColor: '#f0f0f0',
    padding: 10,
  },
  debugText: {
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 4,
  },
  debugContent: {
    fontFamily: 'monospace',
    fontSize: 10,
    backgroundColor: '#e0e0e0',
    padding: 8,
    borderRadius: 2,
  },
});

export default StaticTest;
