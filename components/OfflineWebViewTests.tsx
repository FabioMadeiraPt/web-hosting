import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import TcpSocket from 'react-native-tcp-socket';
import { WebView } from 'react-native-webview';

// Static imports for assets
import indexHtml from '../assets/dist/index.html';
// import favicon from '../assets/dist/favicon.ico';

const OfflineWebViewTests = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Map filenames to their corresponding assets
  const assetsMap: Record<string, any> = {
    'index.html': indexHtml,
    //'favicon.ico': favicon,
    // 'style.css': styleCss,
    // 'script.js': scriptJs,
  };

  const copyDistFolder = async () => {
    const distFolderUri = FileSystem.documentDirectory + 'dist/';
    const folderInfo = await FileSystem.getInfoAsync(distFolderUri);
    if (!folderInfo.exists) {
      // Create the dist folder
      await FileSystem.makeDirectoryAsync(distFolderUri, { intermediates: true });
      console.log(`Created dist folder at ${distFolderUri}`);
      // List of files in the assets/dist folder
      const files = ['index.html'];

      await Promise.all(
        files.map(async (file) => {
          console.log(`Copying ${file} to ${distFolderUri}`);
          const asset = Asset.fromModule(assetsMap[file]); // Resolve the asset
          await asset.downloadAsync(); // Ensure the asset is downloaded
          const fileUri = distFolderUri + file; // Destination URI in the writable directory
          await FileSystem.copyAsync({ from: asset.localUri!, to: fileUri });
        }),
      );
    }
  };

  useEffect(() => {
    const initialize = async () => {
      console.log('Initializing OfflineWebViewTests...');
      console.log('################################################');

      try {
        // Copy the dist folder to the file system
        await copyDistFolder();

        const distFolderUri = FileSystem.documentDirectory + 'dist/';
        let server: TcpSocket.Server | null = null;

        // Start the custom web server
        server = TcpSocket.createServer((socket) => {
          console.log('Client connected');

          // Set a timeout to prevent hanging connections
          socket.setTimeout(5000, () => {
            console.log('Connection timed out');
            socket.end();
          });

          // Handle connection errors
          socket.on('error', (error) => {
            console.error('Socket error:', error);
            socket.end();
          });

          // Handle connection close
          socket.on('close', () => {
            console.log('Client disconnected');
          });

          socket.on('data', async (data) => {
            const request = data.toString();
            const match = request.match(/GET (.+?) HTTP/); // Extract the requested file path
            const filePath = match ? match[1] : '/index.html'; // Default to index.html

            console.log(`Received request for: ${filePath}`);

            const fileUri = distFolderUri + (filePath === '/' ? 'index.html' : filePath.slice(1));

            try {
              // Handle favicon.ico explicitly
              if (filePath === '/favicon.ico') {
                const response = `HTTP/1.1 200 OK\r\nContent-Type: image/x-icon\r\nContent-Length: 0\r\nConnection: close\r\n\r\n`;
                socket.write(response);
                socket.end();
                return;
              }

              const fileContent = await FileSystem.readAsStringAsync(fileUri);
              const contentType = filePath.endsWith('.html')
                ? 'text/html'
                : filePath.endsWith('.js')
                  ? 'application/javascript'
                  : filePath.endsWith('.css')
                    ? 'text/css'
                    : 'text/plain';

              // Add Content-Length header to help browsers process the response correctly
              const contentLength = Buffer.byteLength(fileContent, 'utf8');
              const response = `HTTP/1.1 200 OK\r\nContent-Type: ${contentType}\r\nContent-Length: ${contentLength}\r\nConnection: close\r\n\r\n${fileContent}`;

              console.log(`Serving ${filePath} (${contentLength} bytes)`);
              socket.write(response);
            } catch (err) {
              const errorMessage = 'File not found';
              const contentLength = Buffer.byteLength(errorMessage, 'utf8');
              const response = `HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: ${contentLength}\r\nConnection: close\r\n\r\n${errorMessage}`;

              console.error('File not found:', fileUri, err);
              socket.write(response);
            }

            // End the socket properly instead of destroying it
            socket.end();
          });
        });

        server.on('error', (err) => {
          console.error('Server error:', err);
          setError('Server error: ' + err.message);
        });

        server.listen(8080, '127.0.0.1', () => {
          console.log('Server is running at http://127.0.0.1:8080');
          setServerUrl('http://127.0.0.1:8080');
          setIsLoading(false);
        });

        return () => {
          if (server) {
            console.log('Closing server');
            server.close();
          }
        };
      } catch (err: any) {
        console.error('Failed to start custom web server:', err);
        setError('Error starting custom web server: ' + err.message);
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text>There was a error</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={{ textAlign: 'center', marginBottom: 10 }}>WebView Test - Server: {serverUrl}</Text>
      {serverUrl && (
        <WebView
          //style={styles.container}
          source={{ uri: serverUrl }}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          onLoadStart={() => console.log('WebView loading started')}
          onLoadEnd={() => console.log('WebView loading ended')}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView error:', nativeEvent);
          }}
          renderLoading={() => (
            <View style={styles.center}>
              <Text>Loading WebView...</Text>
            </View>
          )}
          startInLoadingState={true}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
  },
});

export default OfflineWebViewTests;
