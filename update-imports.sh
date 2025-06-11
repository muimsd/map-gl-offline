#!/bin/bash

# Script to update all import statements to match renamed files

echo "Updating UI import statements to match renamed files..."

# Update imports in all files
find src/ui -name "*.ts" -exec sed -i '' \
  -e "s|from.*['\"].*downloadManager['\"]|from './DownloadManager'|g" \
  -e "s|from.*['\"].*\/downloadManager['\"]|from '../DownloadManager'|g" \
  -e "s|from.*['\"].*\/managers\/downloadManager['\"]|from '../managers/DownloadManager'|g" \
  -e "s|from.*['\"].*\/\.\./managers\/downloadManager['\"]|from '../../managers/DownloadManager'|g" \
  -e "s|from.*['\"].*regionFormModal['\"]|from './RegionFormModal'|g" \
  -e "s|from.*['\"].*\/regionFormModal['\"]|from '../RegionFormModal'|g" \
  -e "s|from.*['\"].*\/modals\/regionFormModal['\"]|from '../modals/RegionFormModal'|g" \
  -e "s|from.*['\"].*\/\.\./modals\/regionFormModal['\"]|from '../../modals/RegionFormModal'|g" \
  -e "s|from.*['\"].*confirmationModal['\"]|from './ConfirmationModal'|g" \
  -e "s|from.*['\"].*\/confirmationModal['\"]|from '../ConfirmationModal'|g" \
  -e "s|from.*['\"].*\/modals\/confirmationModal['\"]|from '../modals/ConfirmationModal'|g" \
  -e "s|from.*['\"].*\/\.\./modals\/confirmationModal['\"]|from '../../modals/ConfirmationModal'|g" \
  -e "s|from.*['\"].*regionDetailsModal['\"]|from './RegionDetailsModal'|g" \
  -e "s|from.*['\"].*\/regionDetailsModal['\"]|from '../RegionDetailsModal'|g" \
  -e "s|from.*['\"].*\/modals\/regionDetailsModal['\"]|from '../modals/RegionDetailsModal'|g" \
  -e "s|from.*['\"].*\/\.\./modals\/regionDetailsModal['\"]|from '../../modals/RegionDetailsModal'|g" \
  -e "s|from.*['\"].*importExportModal['\"]|from './ImportExportModal'|g" \
  -e "s|from.*['\"].*\/importExportModal['\"]|from '../ImportExportModal'|g" \
  -e "s|from.*['\"].*\/modals\/importExportModal['\"]|from '../modals/ImportExportModal'|g" \
  -e "s|from.*['\"].*\/\.\./modals\/importExportModal['\"]|from '../../modals/ImportExportModal'|g" \
  -e "s|from.*['\"].*modalManager['\"]|from './ModalManager'|g" \
  -e "s|from.*['\"].*\/modalManager['\"]|from '../ModalManager'|g" \
  -e "s|from.*['\"].*\/modals\/modalManager['\"]|from '../modals/ModalManager'|g" \
  -e "s|from.*['\"].*\/\.\./modals\/modalManager['\"]|from '../../modals/ModalManager'|g" \
  {} \;

echo "Import updates completed!"
