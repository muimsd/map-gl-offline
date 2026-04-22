/**
 * Arabic translations for map-gl-offline
 * الترجمة العربية لـ map-gl-offline
 */

export const ar = {
  // General - عام
  'app.title': 'مدير الخرائط غير المتصلة',
  'app.close': 'إغلاق',
  'app.cancel': 'إلغاء',
  'app.save': 'حفظ',
  'app.delete': 'حذف',
  'app.confirm': 'تأكيد',
  'app.ok': 'موافق',
  'app.loading': 'جاري التحميل...',
  'app.error': 'خطأ',
  'app.success': 'نجاح',
  'app.warning': 'تحذير',
  'app.refresh': 'تحديث',
  'app.details': 'التفاصيل',
  'app.focus': 'التركيز',

  // Theme - السمة
  'theme.toggle': 'تبديل السمة',
  'theme.light': 'فاتح',
  'theme.dark': 'داكن',

  // Language - اللغة
  'language.select': 'اختر اللغة',
  'language.en': 'الإنجليزية',
  'language.ar': 'العربية',

  // Header - الرأس
  'header.title': 'مدير الخرائط غير المتصلة',
  'header.subtitle': '{{count}} منطقة • {{size}} إجمالي',

  // Actions - الإجراءات
  'actions.addRegion': 'إضافة منطقة',
  'actions.refresh': 'تحديث',
  'actions.loadStyle': 'تحميل النمط',
  'actions.fixTiles': 'إصلاح البلاطات',
  'actions.deleteStyle': 'حذف النمط',
  'actions.redownload': 'إعادة التحميل',
  'actions.importExport': 'استيراد/تصدير',

  // Region Form - نموذج المنطقة
  'regionForm.title': 'تحميل منطقة غير متصلة',
  'regionForm.subtitle': 'المساحة المحددة: {{area}} كم²',
  'regionForm.name': 'اسم المنطقة',
  'regionForm.namePlaceholder': 'مثال: وسط المدينة',
  'regionForm.minZoom': 'أدنى تكبير',
  'regionForm.maxZoom': 'أقصى تكبير',
  'regionForm.styleUrl': 'رابط النمط',
  'regionForm.provider': 'مزود النمط',
  'regionForm.providerAuto': 'اكتشاف تلقائي',
  'regionForm.providerMapbox': 'Mapbox GL (يتطلب رمز الوصول)',
  'regionForm.providerMaplibre': 'MapLibre GL (مفتوح المصدر)',
  'regionForm.providerInfo': 'سيقوم الاكتشاف التلقائي بتحليل رابط النمط لتحديد المزود',
  'regionForm.accessToken': 'رمز وصول Mapbox',
  'regionForm.accessTokenRequired': 'مطلوب',
  'regionForm.accessTokenHelp': 'احصل على رمز الوصول من',
  'regionForm.downloadRegion': 'تحميل المنطقة',
  'regionForm.area': 'المساحة',
  'regionForm.bounds': 'الحدود',
  'regionForm.extraSources': 'مصادر بلاطات إضافية',
  'regionForm.extraSourcesInfo': 'اختر طبقات إضافية من الخريطة لتضمينها في هذه المنطقة',
  'regionForm.noExtraSources': 'لم يتم العثور على مصادر بلاطات إضافية على الخريطة',
  'regionForm.sourceType.vector': 'متجه',
  'regionForm.sourceType.raster': 'نقطي',
  'regionForm.sourceType.raster-dem': 'تضاريس',
  'regionForm.selectAll': 'تحديد الكل',
  'regionForm.deselectAll': 'إلغاء تحديد الكل',

  // Region List - قائمة المناطق
  'regionList.empty': 'لم يتم العثور على أنماط أو مناطق غير متصلة. انقر على "إضافة منطقة" للبدء.',
  'regionList.emptyFallback': 'لم يتم العثور على مناطق غير متصلة. انقر على "إضافة منطقة" للبدء.',
  'regionList.orphanedHeader': 'مناطق بدون نمط',
  'regionList.orphanedDescription': '{{count}} منطقة غير مرتبطة بأي نمط',
  'regionList.zoom': 'التكبير',
  'regionList.downloaded': 'تم التحميل',
  'regionList.size': 'الحجم',
  'regionList.tiles': 'البلاطات',
  'regionList.styleData': 'النمط',
  'regionList.totalSize': 'الإجمالي',
  'regionList.styleId': 'معرف النمط',

  // Region Details - تفاصيل المنطقة
  'regionDetails.title': 'تفاصيل المنطقة',
  'regionDetails.focusOnMap': 'التركيز على الخريطة',

  // Style - النمط
  'style.unnamedStyle': 'نمط بدون اسم',
  'style.regions': '{{count}} منطقة',

  // Delete Confirmation - تأكيد الحذف
  'delete.regionTitle': 'حذف المنطقة',
  'delete.regionMessage': 'هل أنت متأكد من حذف المنطقة "{{name}}"؟ لا يمكن التراجع عن هذا الإجراء.',
  'delete.styleTitle': 'حذف النمط',
  'delete.styleMessage':
    'هل أنت متأكد من حذف النمط "{{name}}"؟ لا يمكن التراجع عن هذا الإجراء وسيؤثر على المناطق المرتبطة.',

  // Re-download - إعادة التحميل
  'redownload.title': 'إعادة تحميل المنطقة',
  'redownload.message':
    'إعادة تحميل "{{name}}"؟\n\nسيتم:\n• حذف البلاطات والموارد الحالية\n• إعادة تحميل جميع البيانات بالإعدادات الحالية\n• إصلاح أي موارد تالفة أو قديمة',
  'redownload.button': 'إعادة التحميل',

  // Fix Tiles - إصلاح البلاطات
  'fixTiles.noIssuesTitle': 'لم يتم العثور على مشاكل',
  'fixTiles.noIssuesMessage': 'لم يتم اكتشاف بلاطات مضغوطة. البلاطات بالتنسيق الصحيح!',
  'fixTiles.title': 'إصلاح البلاطات المضغوطة',
  'fixTiles.message':
    'تم العثور على {{count}} بلاطة مضغوطة قد تسبب أخطاء في العرض.\n\nسيتم:\n1. إزالة جميع البلاطات المضغوطة ({{count}} بلاطة)\n2. ستحتاج إلى إعادة تحميل المناطق للحصول على بلاطات مفكوكة الضغط\n\nهل تريد المتابعة؟',
  'fixTiles.button': 'إصلاح البلاطات',
  'fixTiles.completeTitle': 'اكتمل التنظيف',
  'fixTiles.completeMessage':
    'تم إزالة {{count}} بلاطة مضغوطة بنجاح.\n\nيرجى إعادة تحميل مناطقك للحصول على البلاطات المصححة.',

  // Download Progress - تقدم التحميل
  'download.active': 'التحميلات النشطة',
  'download.phase.style': 'النمط',
  'download.phase.sprites': 'الرموز',
  'download.phase.glyphs': 'الخطوط',
  'download.phase.tiles': 'البلاطات',

  // Style Selection - اختيار النمط
  'styleSelection.title': 'اختر نمط غير متصل',
  'styleSelection.message': 'اختر النمط غير المتصل الذي تريد تحميله:',
  'styleSelection.sources': 'مصادر',

  // Errors - الأخطاء
  'error.loadingContent': 'خطأ في تحميل المحتوى',
  'error.tryAgain': 'يرجى المحاولة مرة أخرى',
  'error.mapNotInitialized': 'الخريطة غير مهيأة. يرجى التأكد من تحميل الخريطة قبل تحميل النمط.',
  'error.invalidStyleData': 'بيانات نمط غير صالحة. قد يكون النمط تالفاً.',
  'error.styleMissingSources': 'النمط لا يحتوي على مصادر. قد يكون النمط غير مكتمل.',
  'error.styleMissingLayers': 'النمط لا يحتوي على طبقات. قد يكون النمط غير مكتمل.',
  'error.regionNotFound': 'المنطقة غير موجودة',
  'error.downloadFailed': 'فشل التحميل',
  'error.deleteFailed': 'فشل الحذف',
  'error.loadStyleFailed': 'فشل تحميل النمط',

  // Warnings - التحذيرات
  'warning.compressedTiles': 'تم العثور على {{count}} بلاطة مضغوطة قد تسبب مشاكل في العرض.',
  'warning.compressedTilesRecommendation': 'موصى به: استخدم زر "إعادة التحميل" لإصلاح هذه المشكلة.',
  'warning.continueAnyway': 'هل تريد الاستمرار في تحميل النمط على أي حال؟',

  // Drawing Tool - أداة الرسم
  'drawing.instructions': 'انقر واسحب لرسم منطقة',
  'drawing.cancel': 'اضغط ESC للإلغاء',

  // Offline Maps Button - زر الخرائط غير المتصلة
  'button.offlineMaps': 'خرائط غير متصلة',

  // Region Details Modal - نافذة تفاصيل المنطقة
  'regionDetails.bounds': 'الحدود',
  'regionDetails.zoomRange': 'نطاق التكبير',
  'regionDetails.created': 'تاريخ الإنشاء',

  // MBTiles Modal - نافذة MBTiles
  'mbtiles.title': 'استيراد / تصدير MBTiles',
  'mbtiles.regionInfo': 'معلومات المنطقة',
  'mbtiles.id': 'المعرف',
  'mbtiles.name': 'الاسم',
  'mbtiles.unnamed': 'بدون اسم',
  'mbtiles.zoom': 'التكبير',
  'mbtiles.created': 'تاريخ الإنشاء',
  'mbtiles.exportTitle': 'التصدير كـ MBTiles',
  'mbtiles.exportHint':
    'احزم بلاطات هذه المنطقة داخل أرشيف MBTiles (SQLite) يمكن فتحه في QGIS و tippecanoe وأدوات أخرى.',
  'mbtiles.exportButton': 'تنزيل ملف mbtiles.',
  'mbtiles.preparingExport': 'جاري تجهيز التصدير...',
  'mbtiles.exportComplete': 'اكتمل التصدير!',
  'mbtiles.exportFailed': 'فشل التصدير. يرجى المحاولة مرة أخرى.',
  'mbtiles.importTitle': 'الاستيراد من MBTiles',
  'mbtiles.selectFile': 'اختر ملف mbtiles.',
  'mbtiles.fileHint': 'تُدعم ملفات mbtiles. بتنسيق SQLite فقط.',
  'mbtiles.newRegionName': 'اسم المنطقة الجديد (اختياري)',
  'mbtiles.newRegionNamePlaceholder': 'اتركه فارغًا لاستخدام الاسم من الملف',
  'mbtiles.overwriteIfExists': 'الكتابة فوق المنطقة إذا كان المعرف موجودًا',
  'mbtiles.importButton': 'استيراد ملف mbtiles.',
  'mbtiles.preparingImport': 'جاري تجهيز الاستيراد...',
  'mbtiles.importComplete': 'اكتمل الاستيراد!',
  'mbtiles.importFailed': 'فشل الاستيراد. يرجى المحاولة مرة أخرى.',
  'mbtiles.aboutTitle': 'حول MBTiles',
  'mbtiles.aboutBody':
    'MBTiles هو حاوية قائمة على SQLite لبلاطات الخرائط. يُنتج هذا المُصدِّر ملفات متوافقة مع v1.3 وترتيب TMS، ويقرأ المُستورِد نفس التنسيق إلى التخزين دون الإنترنت.',

  // Active Downloads - التحميلات النشطة
  'download.activeCount': 'التحميلات النشطة ({{count}})',

  // Panel Manager additional strings - سلاسل إضافية للوحة
  'panel.downloadedRegions': 'المناطق المحملة',
  'panel.noExpiry': 'بدون انتهاء',
  'panel.noBounds': 'بدون حدود',
  'panel.sources': 'مصادر',

  // Empty/Error States - حالات الفراغ/الخطأ
  'emptyState.title': 'لا توجد عناصر',
  'emptyState.message': 'لا توجد عناصر للعرض',
  'errorState.message': 'حدث خطأ ما',
  'errorState.retry': 'حاول مرة أخرى',

  // List - القائمة
  'list.empty': 'لا توجد عناصر للعرض',
  'list.noItemsFound': 'لم يتم العثور على عناصر',

  // Toast - الإشعارات
  'toast.dismiss': 'إغلاق الإشعار',

  // Control Buttons - أزرار التحكم
  'control.offlineMapManager': 'مدير الخرائط غير المتصلة',
  'control.cancelSelection': 'إلغاء التحديد',
  'control.saveSelectedRegion': 'حفظ المنطقة المحددة',

  // Alerts/Messages - التنبيهات/الرسائل
  'alert.unknownError': 'حدث خطأ غير معروف',
  'alert.downloadNotImplemented': 'ميزة التحميل غير مطبقة في هذه النسخة',
  'alert.mapNotAvailable': 'الخريطة غير متاحة',
  'alert.invalidBounds': 'حدود غير صالحة للمنطقة',
  'alert.styleNotFound': 'النمط غير موجود',
  'alert.noStylesFound': 'لم يتم العثور على أنماط في IndexedDB',
  'alert.failedToApplyStyle': 'فشل تطبيق النمط على الخريطة',
  'alert.failedToLoadStyle': 'فشل تحميل النمط',
  'alert.failedToRedownload': 'فشل إعادة تحميل المنطقة',
  'alert.downloadManagerNotAvailable': 'مدير التحميل غير متاح',

  // Download Manager - مدير التحميل
  'downloadManager.downloadingStyle': 'جاري تحميل النمط',
  'downloadManager.downloadingSprites': 'جاري تحميل الرموز',
  'downloadManager.downloadingGlyphs': 'جاري تحميل الخطوط',
  'downloadManager.downloadingTiles': 'جاري تحميل البلاطات',
  'downloadManager.styleExistsNotFound': 'النمط موجود لكن لم يتم العثور عليه',
  'downloadManager.styleNotFoundForResources': 'لم يتم العثور على النمط لتحميل الموارد',
  'downloadManager.styleNotFoundForTiles': 'لم يتم العثور على النمط لتحميل البلاطات',
  'downloadManager.styleNoSources': 'النمط لا يحتوي على مصادر لتحميل البلاطات',

  // Form Validation - التحقق من النموذج
  'validation.required': 'هذا الحقل مطلوب',
  'validation.invalidFormat': 'تنسيق غير صالح',
  'validation.mustBeNumber': 'يجب أن يكون رقماً',
  'validation.mustBeWholeNumber': 'يجب أن يكون رقماً صحيحاً',
  'validation.invalidUrl': 'تنسيق رابط غير صالح',
} as const;
